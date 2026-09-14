-- Roster and apparatus-check slots for the Oradell Fire Department TC
-- Scheduler. Safe to re-run: uses INSERT OR IGNORE keyed on primary key.
--
-- Members are seeded as placeholder users (is_placeholder=1, is_active=1 —
-- already-trusted roster, not a self-signup) so the schedule and rotation
-- work immediately after deploy; each member's first real OTP sign-in with
-- a matching email claims their row (see lib/auth/session.ts).
--
-- Apply with:
--   wrangler d1 execute ofd-tc-scheduler --local --file=./db/seed.sql   (dev)
--   wrangler d1 execute ofd-tc-scheduler --remote --file=./db/seed.sql  (prod)

INSERT OR IGNORE INTO users (id, email, name, line_number, roster_status, remarks, roster_active, rotation_position, is_active, is_placeholder) VALUES
  ('c330485e-34d3-4ed7-9a7c-6b89b4b1464b', 'jbonaglia@oradellfire.org', 'J. Bonaglia', '33', 'active', NULL, 1, 1, 1, 1),
  ('894521b8-7e1e-48e0-b34e-61d2cc73777b', 'skufel@oradellfire.org', 'S. Kufel', '34', '50yr', NULL, 1, 2, 1, 1),
  ('b6ae7466-c515-4531-a311-9efb4adc263a', 'btsagarato@oradellfire.org', 'B. Tsagaratos', '35', 'active', NULL, 1, 3, 1, 1),
  ('1bf090fa-0f4c-4707-b091-b50222f7785b', 'charris@oradellfire.org', 'C. Harris', '36', 'active', NULL, 1, 4, 1, 1),
  ('a4ccd942-5613-466e-9176-ff5d61cdb344', 'nroux@oradellfire.org', 'N. Roux', '37', 'active', NULL, 1, 5, 1, 1),
  ('9f395d14-0b01-4af8-9b03-2617cd864fa2', 'sverducci@oradellfire.org', 'S. Verducci', '38', 'active', NULL, 1, 6, 1, 1),
  ('cd87b376-7a45-40e5-bb44-d80fa53c4dbc', 'roster-741aabf6-193b-48c8-84e9-a298ef530bc9@placeholder.invalid', 'C. May', '41', '50yr', NULL, 1, 7, 1, 1),
  ('fe2000c6-a7dc-4526-b3a5-75a77587492d', 'wfricke@oradellfire.org', 'W. Fricke', '42', 'active', NULL, 1, 8, 1, 1),
  ('8be2d437-a463-4b6c-9f9b-0f22e569252d', 'jkoth@oradellfire.org', 'J. Koth III', '43', 'active', 'P&A', 1, 9, 1, 1),
  ('21cbbfdc-eef7-44ef-95ba-e5293065b4a5', 'mzempol@oradellfire.org', 'M. Zempol', '44', 'active', NULL, 1, 10, 1, 1),
  ('95de41a7-a09e-4baa-b05c-40fa462fb50c', 'fgangemi@oradellfire.org', 'F. Gangemi', '45', 'active', 'P&A', 1, 11, 1, 1),
  ('a46337f5-ad39-4149-b820-7f21a8b14fb9', 'sgencarelli@oradellfire.org', 'S. Gencarelli', '46', 'active', NULL, 1, 12, 1, 1),
  ('b117c97a-bdbe-4395-85f8-d1ab1c8fb70c', 'rkwon@oradellfire.org', 'R. Kwon', '48', 'active', NULL, 1, 13, 1, 1),
  ('a0e6d002-358a-4cba-a1c1-29a2f0be0570', 'dkahill@oradellfire.org', 'D. Kahill', '49', 'active', 'P&A', 1, 14, 1, 1),
  ('c36bc9f5-f2fb-4941-9cc9-cb7bfd7d99f5', 'kburns@oradellfire.org', 'Lt. K. Burns', '50', 'officer', NULL, 1, 15, 1, 1),
  ('c9aa0677-3505-4f81-af3e-39cf4e884362', 'hpobutkiewicz@oradellfire.org', 'H. Pobutkiewicz', '51', 'active', NULL, 1, 16, 1, 1),
  ('ff17a435-b24b-4021-b173-16aafc7d56df', 'tkellerman@oradellfire.org', 'T. Kellerman', '52', 'active', NULL, 1, 17, 1, 1),
  ('d338d087-2ed9-424b-85ec-ae52a78d880f', 'jkufel@oradellfire.org', 'J. Kufel', '54', 'active', NULL, 1, 18, 1, 1),
  ('f1783827-3e1e-4bc0-a406-42e2e201d531', 'rlarkin@oradellfire.org', 'R. Larkin', '55', 'active', NULL, 1, 19, 1, 1),
  ('388f14bd-496a-4243-a5a4-4f592f24c5d5', 'agianfrancesco@oradellfire.org', 'A. Gianfrancesco', '56', 'active', NULL, 1, 20, 1, 1),
  ('d1c7fe76-b03f-4fa5-93f2-53c6aeea38d4', 'jpellechio@oradellfire.org', 'J. Pellechio', '57', 'active', NULL, 1, 21, 1, 1),
  ('9f0e5c69-62f5-4cf0-93e2-4ac8ed4b8b1a', 'lbosetti@oradellfire.org', 'L. Bosetti', '58', 'active', NULL, 1, 22, 1, 1),
  ('5124a8d7-99cf-4825-9efb-d78e26da1656', 'vparmar@oradellfire.org', 'V. Parmar', '59', 'active', NULL, 1, 23, 1, 1),
  ('49799ecc-e27d-4b28-ba3b-a353fba87f79', 'emata@oradellfire.org', 'E. Mata', '60', 'active', NULL, 1, 24, 1, 1),
  ('bf0dae5f-8a62-42bc-b260-a612c743cd58', 'dgonzalez@oradellfire.org', 'D. Gonzalez', '61', 'active', NULL, 1, 25, 1, 1),
  ('fb4e7eac-c914-446a-9607-43f90fecf7a9', 'epak@oradellfire.org', 'E. Pak', NULL, 'active', NULL, 1, 26, 1, 1),
  ('8eb86c63-8301-4666-a6ac-b0f82841e41f', 'tmurray@oradellfire.org', 'T. Murray', NULL, 'active', NULL, 1, 27, 1, 1),
  ('6301bfea-16a5-4bda-8bf7-5a0e1053e0e0', 'npintoshaw@oradellfire.org', 'N. Pinto-Shaw', NULL, 'active', NULL, 1, 28, 1, 1),
  ('e1d14283-5d4e-44f6-b95c-62c0e4be2469', 'aburns@oradellfire.org', 'A. Burns', NULL, 'active', NULL, 1, 29, 1, 1),
  ('998bdf1a-3957-4aa9-bddd-4502dc454535', 'bbonte@oradellfire.org', 'B. Bonte', NULL, 'active', NULL, 1, 30, 1, 1),
  ('b75d5819-6783-4ae5-a94f-368c26a5a01d', 'jdestefano@oradellfire.org', 'J. DeStefano', NULL, 'active', NULL, 1, 31, 1, 1),
  ('85df40f4-0e50-414c-aa52-d248e42bc830', 'dschneider@oradellfire.org', 'D. Schneider', NULL, 'active', NULL, 1, 32, 1, 1),
  ('ffc84c7b-a657-40ca-a134-1c0c2134231f', 'jkaplan@oradellfire.org', 'J. Kaplan', NULL, 'active', NULL, 1, 33, 1, 1);

INSERT OR IGNORE INTO assignment_slots (id, apparatus_name, slot_type, rotation_note, rotation_labels, oic_name, sort_order) VALUES
  ('bfa80407-424b-4cf6-92b4-c07cf3abef47', 'Pumps & Aerial', 'Pumps & Aerial', 'Different Engine or Ladder Each Week', NULL, 'A/C Moretti', 1),
  ('e7ca457f-e6e8-47cf-a5ec-7b102a5f0a61', 'Tower 21', 'Apparatus & Equipment', 'Alternate Sides Each Week', '["Officer","Driver"]', 'Lt. Jaimes', 2),
  ('946edd67-45c3-4277-a0cd-58a2139cc161', 'Tower 21', 'SCBA', NULL, NULL, 'Lt. Jaimes', 3),
  ('0f7d8675-60c6-4712-b681-f3f3fd02082b', 'Squad 22', 'Apparatus & Equipment', 'Alternate Sides Each Week', '["Driver","Officer"]', 'Capt. Bernard', 4),
  ('5b918453-d52c-48bf-9cd5-e1cc6d712829', 'Squad 22', 'SCBA', NULL, NULL, 'Capt. Bernard', 5),
  ('d9f2c648-2c2f-450b-b7f2-efe74ad13310', 'Engine 23 & Engine 24', 'Apparatus & Equipment', 'Alternate Engine Each Week', '["Engine 23","Engine 24"]', 'Lt. Haak / Lt. Burns', 6),
  ('10c305ba-12db-47d5-b0c8-5df4de9bbfda', 'Engine 23', 'SCBA', NULL, NULL, 'Lt. Haak / Lt. Burns', 7),
  ('fb0a97f0-4039-4a2d-8ba6-86cd35f9bda0', 'Engine 24', 'SCBA', NULL, NULL, 'Lt. Haak / Lt. Burns', 8);

