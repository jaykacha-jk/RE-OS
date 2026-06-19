/**
 * Express JSON/urlencoded body limit for API routes that accept base64 media
 * (property images up to 10MB decoded, videos up to 50MB decoded).
 * Base64 expands payload ~4/3; 75mb leaves headroom for JSON metadata.
 */
export const API_JSON_BODY_LIMIT = '75mb';
