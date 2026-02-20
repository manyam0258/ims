import frappe
import os
import shutil


def execute():
    print("Starting aggressive file move and URL fix...")

    site_path = frappe.get_site_path()
    public_files_path = os.path.join(site_path, "public", "files")
    private_files_path = os.path.join(site_path, "private", "files")

    # 1. Fix Marketing Assets
    assets = frappe.get_all("IMS Marketing Asset", fields=["name", "latest_file"])
    for asset in assets:
        if asset.latest_file and asset.latest_file.startswith("/private/files/"):
            file_name = asset.latest_file.split("/")[-1]
            public_url = f"/files/{file_name}"

            # Move file on disk
            private_path = os.path.join(private_files_path, file_name)
            public_path = os.path.join(public_files_path, file_name)

            if os.path.exists(private_path):
                if not os.path.exists(public_path):
                    shutil.move(private_path, public_path)
                    print(f"Moved file on disk: {private_path} -> {public_path}")
                else:
                    print(f"File already exists in public: {public_path}")

            # Update Asset Doc
            frappe.db.set_value(
                "IMS Marketing Asset", asset.name, "latest_file", public_url
            )
            print(
                f"Updated Asset {asset.name} URL: {asset.latest_file} -> {public_url}"
            )

            # Update File Doc(s)
            file_docs = frappe.get_all("File", filters={"file_url": asset.latest_file})
            for f in file_docs:
                frappe.db.set_value(
                    "File", f.name, {"file_url": public_url, "is_private": 0}
                )
                print(f"Updated File Doc {f.name} to public URL")

    # 2. Fix Revisions
    revisions = frappe.get_all("IMS Asset Revision", fields=["name", "revision_file"])
    for rev in revisions:
        if rev.revision_file and rev.revision_file.startswith("/private/files/"):
            file_name = rev.revision_file.split("/")[-1]
            public_url = f"/files/{file_name}"

            # Move file on disk
            private_path = os.path.join(private_files_path, file_name)
            public_path = os.path.join(public_files_path, file_name)

            if os.path.exists(private_path):
                if not os.path.exists(public_path):
                    shutil.move(private_path, public_path)
                    print(f"Moved file on disk: {private_path} -> {public_path}")
                else:
                    print(f"File already exists in public: {public_path}")

            # Update Revision Doc
            frappe.db.set_value(
                "IMS Asset Revision", rev.name, "revision_file", public_url
            )
            print(
                f"Updated Revision {rev.name} URL: {rev.revision_file} -> {public_url}"
            )

            # Update File Doc(s)
            file_docs = frappe.get_all("File", filters={"file_url": rev.revision_file})
            for f in file_docs:
                frappe.db.set_value(
                    "File", f.name, {"file_url": public_url, "is_private": 0}
                )
                print(f"Updated File Doc {f.name} to public URL")

    frappe.db.commit()
    print("Aggressive fix completed.")
