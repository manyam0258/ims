# Copyright (c) 2026, surendhranath and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.model.document import Document


class IMSAssetRevision(Document):
    """Controller for IMS Asset Revision.

    Manages revision numbering and annotation data integrity for
    each version of a marketing asset.
    """

    def before_insert(self):
        self.set_revision_number()
        self.initialize_annotations()

    def validate(self):
        self.validate_annotations_format()
        self.ensure_file_is_private()

    def set_revision_number(self):
        """Auto-increment the revision number based on existing revisions
        for the parent marketing asset."""
        if not self.marketing_asset:
            return

        max_rev = frappe.db.get_value(
            "IMS Asset Revision",
            {"marketing_asset": self.marketing_asset},
            "MAX(revision_number)",
        )
        self.revision_number = (max_rev or 0) + 1

    def initialize_annotations(self):
        """Initialize annotations as an empty JSON array if not set."""
        if not self.annotations:
            self.annotations = json.dumps([])

    def validate_annotations_format(self):
        """Ensure the annotations field contains valid JSON array."""
        if not self.annotations:
            self.annotations = json.dumps([])
            return

        try:
            data = json.loads(self.annotations)
            if not isinstance(data, list):
                frappe.throw("Annotations must be a JSON array.")
        except (json.JSONDecodeError, TypeError):
            frappe.throw("Annotations field contains invalid JSON.")

    def ensure_file_is_private(self):
        """Ensure the revision file is marked as private."""
        if not self.revision_file:
            return

        file_doc = frappe.db.get_value(
            "File",
            {"file_url": self.revision_file},
            ["name", "is_private"],
            as_dict=True,
        )

        if file_doc and not file_doc.is_private:
            frappe.db.set_value("File", file_doc.name, "is_private", 1)

    def after_insert(self):
        """Update the parent marketing asset's latest_file to point
        to this revision's file."""
        if self.marketing_asset and self.revision_file:
            frappe.db.set_value(
                "IMS Marketing Asset",
                self.marketing_asset,
                "latest_file",
                self.revision_file,
            )
