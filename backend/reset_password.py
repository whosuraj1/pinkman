"""Admin utility: reset a user's password.

Run from the backend directory so the DB path and imports resolve:

    cd ~/pinkman/backend
    .venv/bin/python reset_password.py

It prompts for the username and the new password (hidden input) and updates the
stored hash. Use this to change the demo passwords before real use.
"""
import getpass
import sys

from sqlmodel import Session, select

from database import engine
from models import User
from auth import hash_password


def main() -> int:
    username = input("Username to reset: ").strip()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            print(f"No user named '{username}' was found.")
            return 1
        pw1 = getpass.getpass("New password: ")
        pw2 = getpass.getpass("Confirm new password: ")
        if pw1 != pw2:
            print("Passwords do not match. Nothing changed.")
            return 1
        if len(pw1) < 6:
            print("Please use at least 6 characters. Nothing changed.")
            return 1
        user.password_hash = hash_password(pw1)
        session.add(user)
        session.commit()
        print(f"Password updated for '{username}'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
