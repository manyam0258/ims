import frappe


def execute():
    print("Starting permission fix...")

    # 1. Fix Marketing Assets (latest_file)
    assets = frappe.get_all("IMS Marketing Asset", fields=["name", "latest_file"])
    for asset in assets:
        if asset.latest_file:
            file_docs = frappe.get_all(
                "File",
                filters={"file_url": asset.latest_file},
                fields=["name", "is_private"],
            )
            for f in file_docs:
                if f.is_private:
                    frappe.db.set_value("File", f.name, "is_private", 0)
                    print(f"Made public: {asset.latest_file} (Asset: {asset.name})")

    # 2. Fix Revisions (revision_file)
    revisions = frappe.get_all("IMS Asset Revision", fields=["name", "revision_file"])
    for rev in revisions:
        if rev.revision_file:
            file_docs = frappe.get_all(
                "File",
                filters={"file_url": rev.revision_file},
                fields=["name", "is_private"],
            )
            for f in file_docs:
                if f.is_private:
                    frappe.db.set_value("File", f.name, "is_private", 0)
                    print(f"Made public: {rev.revision_file} (Revision: {rev.name})")

    frappe.db.commit()
    print("Permission fix completed.")
