# Bulk client import
Export your Locations & Notes data to CSV with headers:
name, contact, phone, address, terms, arrival, frequency, fleet_notes, specialty, complaints, wash_time, washers
Then in Supabase: Table Editor → clients → Insert → Import data from CSV (set company_id column to your company uuid first, or add it as a CSV column).
The demo artifact's client dataset can be exported to this CSV shape on request.
