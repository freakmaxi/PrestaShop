<?php
/**
 * The pet-id service and the hol.red shortener, called from the shop's server (both are only reachable inside the
 * cluster). Set by environment variables of the store container:
 *
 *   PETID_ADMIN_KEY      the pet-id ADMIN_API_KEY (required; from a secret)
 *   PETID_API_URL        pet-id API, default http://petid-api-service.hol-apps-petid.svc.cluster.local:9999
 *   PETID_SHORTENER_URL  shortener, default http://shortener-service.hol-apps-petid.svc.cluster.local
 *   PETID_TAG_URL        public page of a tag, followed by its id, default https://apps.houseofleo.de/petid/ui/tags/
 */

namespace PrestaShop\Module\TagDesigner;

use RuntimeException;

if (!defined('_PS_VERSION_')) {
    exit;
}

class PetIdClient
{
    private const DEFAULTS = [
        'PETID_API_URL' => 'http://petid-api-service.hol-apps-petid.svc.cluster.local:9999',
        'PETID_SHORTENER_URL' => 'http://shortener-service.hol-apps-petid.svc.cluster.local',
        'PETID_TAG_URL' => 'https://apps.houseofleo.de/petid/ui/tags/',
    ];

    private const TIMEOUT = 10;

    public function isConfigured(): bool
    {
        return $this->env('PETID_ADMIN_KEY') !== '';
    }

    /**
     * Where the service and the shortener are, for the settings page (never the key).
     *
     * @return array<string, string>
     */
    public function endpoints(): array
    {
        return [
            'api' => $this->env('PETID_API_URL'),
            'shortener' => $this->env('PETID_SHORTENER_URL'),
            'tagUrl' => $this->env('PETID_TAG_URL'),
        ];
    }

    /**
     * Creates a tag in pet-id, as Basic: no validUntil, so it has no Premium features (the tag never expires).
     *
     * @return array{id: string, accessKey: string}
     *
     * @throws RuntimeException
     */
    public function createTag(string $petName, string $font, string $icon): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('The pet-id admin key (PETID_ADMIN_KEY) is not set on the server.');
        }

        $body = json_encode(['petName' => $petName, 'styleCode' => $font, 'iconCode' => $icon]);
        [$status, $response] = $this->request('POST', rtrim($this->env('PETID_API_URL'), '/') . '/admin/client', [
            'Content-Type: application/json',
            'X-Admin-Api-Key: ' . $this->env('PETID_ADMIN_KEY'),
        ], $body);
        if ($status !== 200) {
            throw new RuntimeException(sprintf('pet-id refused the new tag (HTTP %d).', $status));
        }

        $data = json_decode($response, true);
        $id = is_array($data) ? (string) ($data['id'] ?? '') : '';
        $accessKey = is_array($data) ? (string) ($data['accessKey'] ?? '') : '';
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)
            || !preg_match('/^[\x21-\x7e]{1,64}$/', $accessKey)) {
            throw new RuntimeException('pet-id answered without a tag id and access key.');
        }

        return ['id' => strtolower($id), 'accessKey' => $accessKey];
    }

    /**
     * The hol.red link of a tag's page; the shortener gives the same link for the same page every time.
     *
     * @throws RuntimeException
     */
    public function shortLink(string $tagId): string
    {
        $target = $this->env('PETID_TAG_URL') . $tagId;
        [$status, $response] = $this->request(
            'GET',
            rtrim($this->env('PETID_SHORTENER_URL'), '/') . '/c/shorten?r=' . rawurlencode($target),
            [],
            null
        );
        $link = trim($response);
        if ($status !== 200 || !preg_match('#^https://[^\s/]+/[A-Za-z0-9]+$#', $link)) {
            throw new RuntimeException(sprintf('The shortener gave no link (HTTP %d).', $status));
        }

        return $link;
    }

    private function env(string $name): string
    {
        $value = getenv($name);
        if ($value === false || trim($value) === '') {
            return self::DEFAULTS[$name] ?? '';
        }

        return trim($value);
    }

    /**
     * @return array{0: int, 1: string} status and body
     *
     * @throws RuntimeException
     */
    private function request(string $method, string $url, array $headers, ?string $body): array
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ]);
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($response === false) {
            // The URL has no secret in it: the key is a header
            throw new RuntimeException(sprintf('%s is not reachable: %s', parse_url($url, PHP_URL_HOST), $error));
        }

        return [$status, (string) $response];
    }
}
