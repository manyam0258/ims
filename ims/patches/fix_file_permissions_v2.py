import frappe


def execute():
    print("Starting robust permission fix...")

    # 1. Fix Marketing Assets (latest_file)
    assets = frappe.get_all("IMS Marketing Asset", fields=["name", "latest_file"])
    for asset in assets:
        if asset.latest_file:
            # Find the File document(s) associated with this URL
            file_docs = frappe.get_all(
                "File",
                filters={"file_url": asset.latest_file},
                fields=["name", "is_private", "file_url"],
            )
            for f_data in file_docs:
                if f_data.is_private:
                    try:
                        file_doc = frappe.get_doc("File", f_data.name)
                        file_doc.is_private = 0
                        file_doc.save(ignore_permissions=True)
                        frappe.db.commit()
                        print(
                            f"Moved to public: {f_data.file_url} -> {file_doc.file_url} (Asset: {asset.name})"
                        )

                        # Update asset if URL changed
                        if file_doc.file_url != asset.latest_file:
                            frappe.db.set_value(
                                "IMS Marketing Asset",
                                asset.name,
                                "latest_file",
                                file_doc.file_url,
                            )
                            print(
                                f"Updated Asset {asset.name} latest_file to {file_doc.file_url}"
                            )

                    except Exception as e:
                        print(f"Error processing file {f_data.name}: {e}")

    # 2. Fix Revisions (revision_file)
    revisions = frappe.get_all("IMS Asset Revision", fields=["name", "revision_file"])
    for rev in revisions:
        if rev.revision_file:
            file_docs = frappe.get_all(
                "File",
                filters={"file_url": rev.revision_file},
                fields=["name", "is_private", "file_url"],
            )
            for f_data in file_docs:
                if f_data.is_private:
                    try:
                        file_doc = frappe.get_doc("File", f_data.name)
                        file_doc.is_private = 0
                        file_doc.save(ignore_permissions=True)
                        frappe.db.commit()
                        print(
                            f"Moved to public: {f_data.file_url} -> {file_doc.file_url} (Revision: {rev.name})"
                        )

                        # Update revision if URL changed
                        if file_doc.file_url != rev.revision_file:
                            frappe.db.set_value(
                                "IMS Asset Revision",
                                rev.name,
                                "revision_file",
                                file_doc.file_url,
                            )
                            print(
                                f"Updated Revision {rev.name} revision_file to {file_doc.file_url}"
                            )

                    except Exception as e:
                        print(f"Error processing file {f_data.name}: {e}")

    frappe.db.commit()
    print("Robust permission fix completed.")
