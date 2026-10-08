-- Enable Solo Ads in beta mode for the demo publisher only.
-- Leaves an existing solo_ads setting untouched; inserts nothing if the demo publisher does not exist.
INSERT IGNORE INTO `platform_settings` (`id`, `key`, `value`)
SELECT 'solo_ads_setting', 'solo_ads',
       JSON_OBJECT('enabled', CAST('true' AS JSON),
                   'betaOnly', CAST('true' AS JSON),
                   'betaPublisherIds', JSON_ARRAY(u.id))
FROM `users` u
WHERE u.email = 'publisher@cpl.local' AND u.role = 'PUBLISHER'
LIMIT 1;
