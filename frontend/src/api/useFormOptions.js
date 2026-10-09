import { useEffect, useState } from "react";
import { apiGet } from "./client";

// Dropdown values for the Report Incident form, served by the backend so they always
// match what the trained models have actually seen (see backend/scripts/build_form_options.py).
export function useFormOptions() {
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/form-options")
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading, error };
}
