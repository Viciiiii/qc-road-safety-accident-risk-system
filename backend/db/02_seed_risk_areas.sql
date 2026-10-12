-- Seeds the 29 monitored corridors (2022-2025 totals; lat/lng are approximate).
-- Safe to run more than once: corridors that already exist are left untouched.

INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Commonwealth Ave.', 17646, 0.31, 'Medium', 14.6971, 121.0813) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('EDSA', 16426, 0.27, 'Medium', 14.6560, 121.0294) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('C-5 Road / Katipunan Ave.', 10896, 0.20, 'Low', 14.6350, 121.0730) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Quezon Ave.', 7944, 0.24, 'Medium', 14.6425, 121.0244) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Quirino Highway', 6572, 0.44, 'Medium', 14.7150, 121.0430) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Mindanao Ave.', 4900, 0.41, 'Medium', 14.6800, 121.0130) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('C-5 Road', 4405, 0.09, 'Low', 14.6100, 121.0650) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Aurora Blvd.', 3317, 0.39, 'Medium', 14.6180, 121.0550) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Elliptical Road', 2950, 0.24, 'Medium', 14.6510, 121.0490) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Congressional Ave.', 2322, 0.60, 'High', 14.6650, 121.0330) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('E. Rodriguez Sr. Ave.', 1971, 0.51, 'High', 14.6180, 121.0330) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('A. Bonifacio Ave.', 1916, 0.89, 'High', 14.6600, 121.0100) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('G. Araneta Ave.', 1585, 0.57, 'High', 14.6220, 121.0100) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Col. Bonny Serrano Ave.', 1209, 0.08, 'Low', 14.6180, 121.0620) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('IBP Road', 1108, 0.99, 'High', 14.6720, 121.0620) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Regalado Ave.', 933, 0.21, 'Low', 14.7250, 121.0550) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Visayas Ave.', 916, 0.22, 'Low', 14.6720, 121.0350) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Timog Ave.', 902, 0.00, 'Low', 14.6360, 121.0400) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Payatas Road', 877, 1.14, 'High', 14.7080, 121.1080) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('East Ave.', 870, 0.46, 'Medium', 14.6480, 121.0430) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('North Ave.', 868, 0.23, 'Medium', 14.6560, 121.0350) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Tandang Sora Ave.', 840, 0.71, 'High', 14.6870, 121.0530) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Del Monte Ave.', 661, 0.61, 'High', 14.6320, 121.0060) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Kalayaan Ave.', 651, 0.00, 'Low', 14.6350, 121.0680) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('P. Tuazon Blvd.', 613, 0.49, 'High', 14.6190, 121.0620) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Zabarte Road', 579, 0.17, 'Low', 14.7320, 121.0480) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Tomas Morato Ave.', 543, 0.18, 'Low', 14.6330, 121.0380) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Panay Ave.', 528, 0.00, 'Low', 14.6360, 121.0330) ON CONFLICT (corridor) DO NOTHING;
INSERT INTO risk_areas (corridor, total_incidents, high_priority_rate, risk_level, latitude, longitude) VALUES ('Gen. Luis St.', 449, 0.89, 'High', 14.7250, 121.0680) ON CONFLICT (corridor) DO NOTHING;
