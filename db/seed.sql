INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Acme Components', '12 Industrial Road', 'Sydney', 'NSW', 'Australia', 'sales@acme.example', '+61 2 5550 0101'
WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Southern Cross Logistics', '84 Harbour Street', 'Melbourne', 'VIC', 'Australia', 'contact@southerncross.example', '+61 3 5550 0102'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'contact@southerncross.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Pacific Office Supplies', '7 Queen Street', 'Brisbane', 'QLD', 'Australia', 'orders@pacificoffice.example', '+61 7 5550 0103'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'orders@pacificoffice.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Bluegum Industrial', '29 Port Road', 'Adelaide', 'SA', 'Australia', 'hello@bluegum.example', '+61 8 5550 0104'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'hello@bluegum.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Harbour Technology Group', '115 Market Street', 'Perth', 'WA', 'Australia', 'sales@harbourtech.example', '+61 8 5550 0105'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'sales@harbourtech.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Tasman Packaging', '3 Collins Street', 'Hobart', 'TAS', 'Australia', 'service@tasmanpack.example', '+61 3 5550 0106'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'service@tasmanpack.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Coastal Safety Products', '42 Hunter Street', 'Newcastle', 'NSW', 'Australia', 'info@coastalsafety.example', '+61 2 5550 0107'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'info@coastalsafety.example');
INSERT INTO suppliers (name, address, city, state, country, email, phone)
SELECT 'Red Centre Equipment', '16 Todd Mall', 'Alice Springs', 'NT', 'Australia', 'orders@redcentre.example', '+61 8 5550 0108'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE email = 'orders@redcentre.example');
