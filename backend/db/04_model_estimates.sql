-- Saves all three models' estimates for each logged incident, so the app can compare
-- each model's estimate with the confirmed outcome (Records and Analytics pages).
-- The existing "priority" column keeps holding the Random Forest estimate.
-- Safe to run more than once. Run AFTER 03, connected to qc_road_safety as postgres.

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS svm_priority VARCHAR(10)
    CHECK (svm_priority IN ('High', 'Medium', 'Low'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS nb_priority VARCHAR(10)
    CHECK (nb_priority IN ('High', 'Medium', 'Low'));
