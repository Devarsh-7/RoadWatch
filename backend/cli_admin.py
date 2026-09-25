"""
cli_admin.py — RoadWatch Command-Line Administrative Provisioning Tool
=====================================================================
Usage:
    python cli_admin.py create-superuser [--username USER] [--email EMAIL] [--password PASS] [--name NAME]
    python cli_admin.py list-admins
    python cli_admin.py reset-password [--username USER] [--password PASS]
    python cli_admin.py toggle-active --username USER

Provides secure, production-grade administrator lifecycle management.
"""

import sys
import os
import argparse
import getpass
import re

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import AdminUser, OfficerRole
from security import hash_password, validate_password_strength


def get_db_session():
    """Create a new database session."""
    return SessionLocal()


def create_superuser(args):
    """Interactively or non-interactively create a Super Admin user."""
    db = get_db_session()
    try:
        print("\n=== RoadWatch CLI: Create Super Admin ===")
        
        # 1. Username
        username = args.username
        if not username:
            while True:
                username = input("Enter username (3-30 chars, alphanumeric/underscore): ").strip()
                if not username:
                    print("Error: Username cannot be empty.")
                    continue
                if not re.match(r"^[a-zA-Z0-9_]{3,30}$", username):
                    print("Error: Username must be 3-30 characters containing only letters, digits, or underscores.")
                    continue
                break
        else:
            username = username.strip()
            if not re.match(r"^[a-zA-Z0-9_]{3,30}$", username):
                print("Error: Provided username must be 3-30 characters containing only letters, digits, or underscores.")
                sys.exit(1)

        # Check existing username
        if db.query(AdminUser).filter(AdminUser.username == username).first():
            print(f"Error: An administrative user with username '{username}' already exists.")
            sys.exit(1)

        # 2. Email
        email = args.email
        if not email:
            while True:
                email = input("Enter administrative email: ").strip().lower()
                if not email or "@" not in email or "." not in email:
                    print("Error: Please enter a valid email address.")
                    continue
                break
        else:
            email = email.strip().lower()
            if "@" not in email or "." not in email:
                print("Error: Please provide a valid email address.")
                sys.exit(1)

        # Check existing email
        if db.query(AdminUser).filter(AdminUser.email == email).first():
            print(f"Error: An administrative user with email '{email}' already exists.")
            sys.exit(1)

        # 3. Full Name
        name = args.name
        if not name:
            if not args.username or not args.password:
                name = input("Enter administrator full name [Super Admin]: ").strip()
            if not name:
                name = "Super Admin"

        # 4. Password
        password = args.password
        if not password:
            while True:
                password = getpass.getpass("Enter secure password: ")
                password_confirm = getpass.getpass("Confirm password: ")
                if password != password_confirm:
                    print("Error: Passwords do not match. Try again.")
                    continue
                is_valid, msg = validate_password_strength(password)
                if not is_valid:
                    print(f"Error: Weak password ({msg}). Try again.")
                    continue
                break
        else:
            is_valid, msg = validate_password_strength(password)
            if not is_valid:
                print(f"Error: Provided password does not meet security requirements: {msg}")
                sys.exit(1)

        # 5. Create user
        new_user = AdminUser(
            username=username,
            password_hash=hash_password(password),
            email=email,
            name=name,
            role="Super Admin",
            is_active=1,
            is_verified=1
        )
        db.add(new_user)
        db.commit()

        print(f"\n[SUCCESS] Super Admin '{username}' created successfully!")
        print(f"Role: Super Admin | Email: {email} | Verified: Active")
        print("You can now authenticate at /admin-login with these credentials.\n")

    finally:
        db.close()


def list_admins(args):
    """List all administrative accounts currently provisioned."""
    db = get_db_session()
    try:
        users = db.query(AdminUser).order_by(AdminUser.id.asc()).all()
        if not users:
            print("\n[INFO] No administrative accounts found in the database.")
            return

        print(f"\nTotal Registered Officers/Admins: {len(users)}\n")
        header = f"{'ID':<4} | {'Username':<20} | {'Role':<20} | {'State / District':<22} | {'Active':<7} | {'Email'}"
        print(header)
        print("-" * len(header) + "-" * 20)
        for u in users:
            loc = f"{u.state or '-'}" + (f" / {u.district}" if u.district else "")
            active = "Yes" if u.is_active == 1 else "No"
            print(f"{u.id:<4} | {u.username:<20} | {u.role:<20} | {loc:<22} | {active:<7} | {u.email}")
        print()
    finally:
        db.close()


def reset_password(args):
    """Reset the password for an existing administrative user."""
    db = get_db_session()
    try:
        username = args.username
        if not username:
            username = input("Enter username to reset password for: ").strip()

        user = db.query(AdminUser).filter(AdminUser.username == username).first()
        if not user:
            print(f"Error: User '{username}' does not exist.")
            sys.exit(1)

        password = args.password
        if not password:
            while True:
                password = getpass.getpass(f"Enter new password for '{username}': ")
                password_confirm = getpass.getpass("Confirm new password: ")
                if password != password_confirm:
                    print("Error: Passwords do not match.")
                    continue
                is_valid, msg = validate_password_strength(password)
                if not is_valid:
                    print(f"Error: Weak password ({msg}). Try again.")
                    continue
                break
        else:
            is_valid, msg = validate_password_strength(password)
            if not is_valid:
                print(f"Error: Provided password does not meet security requirements: {msg}")
                sys.exit(1)

        user.password_hash = hash_password(password)
        user.reset_password_token = None
        user.reset_password_expires = None
        db.commit()
        print(f"\n[SUCCESS] Password for user '{username}' has been updated successfully.\n")

    finally:
        db.close()


def toggle_active(args):
    """Enable or disable an administrative account."""
    db = get_db_session()
    try:
        username = args.username
        if not username:
            username = input("Enter username: ").strip()

        user = db.query(AdminUser).filter(AdminUser.username == username).first()
        if not user:
            print(f"Error: User '{username}' does not exist.")
            sys.exit(1)

        user.is_active = 0 if user.is_active == 1 else 1
        db.commit()
        status_str = "ACTIVE" if user.is_active == 1 else "DISABLED"
        print(f"\n[SUCCESS] User '{username}' status changed to {status_str}.\n")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="RoadWatch Administrative User CLI Management Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # create-superuser
    create_parser = subparsers.add_parser("create-superuser", help="Create an initial or additional Super Admin user")
    create_parser.add_argument("--username", help="Administrator username")
    create_parser.add_argument("--email", help="Administrator email address")
    create_parser.add_argument("--password", help="Administrator password")
    create_parser.add_argument("--name", help="Administrator full display name")

    # list-admins
    subparsers.add_parser("list-admins", help="List all registered administrative accounts")

    # reset-password
    reset_parser = subparsers.add_parser("reset-password", help="Reset password for an administrative user")
    reset_parser.add_argument("--username", help="Administrator username")
    reset_parser.add_argument("--password", help="New administrator password")

    # toggle-active
    toggle_parser = subparsers.add_parser("toggle-active", help="Enable or disable an admin account")
    toggle_parser.add_argument("--username", required=True, help="Administrator username")

    args = parser.parse_args()

    if args.command == "create-superuser":
        create_superuser(args)
    elif args.command == "list-admins":
        list_admins(args)
    elif args.command == "reset-password":
        reset_password(args)
    elif args.command == "toggle-active":
        toggle_active(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
