"""
ingest.py — CLI tool to fetch and ingest road data directly into the database.

Usage:
  # Ingest from OpenStreetMap (No API key needed)
  python ingest.py --source osm --state "Tamil Nadu" --limit 20

  # Ingest from a CSV file
  python ingest.py --source csv --file path/to/roads.csv
"""

import argparse
import sys
import json
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

from database import SessionLocal
from data_ingestion import fetch_osm_roads, import_roads_csv


def main():
    parser = argparse.ArgumentParser(description="RoadWatch Direct Data Ingestion CLI")
    parser.add_argument(
        "--source",
        choices=["osm", "csv"],
        required=True,
        help="Data source: 'osm' (OpenStreetMap Overpass API) or 'csv' (Local CSV file)"
    )
    parser.add_argument("--state", default="Tamil Nadu", help="Indian State name for OSM queries (default: 'Tamil Nadu')")
    parser.add_argument("--limit", type=int, default=25, help="Maximum records to process (default: 25)")
    parser.add_argument("--file", help="Path to CSV file (required if --source csv)")

    args = parser.parse_args()

    db = SessionLocal()
    try:
        print("\n==========================================")
        print(f"[START] Data Ingestion: Source={args.source.upper()}")
        print("==========================================\n")

        if args.source == "osm":
            result = fetch_osm_roads(db, state_name=args.state, limit=args.limit)
        elif args.source == "csv":
            if not args.file:
                print("[ERROR] --file argument is required when --source is 'csv'")
                sys.exit(1)
            with open(args.file, "rb") as f:
                content = f.read()
            result = import_roads_csv(db, content, filename=args.file)

        print("\n[SUCCESS] Ingestion Finished Successfully:")
        print(json.dumps(result, indent=2))
        print("==========================================\n")

    except Exception as e:
        print(f"\n[ERROR] Ingestion Failed: {e}\n")
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
