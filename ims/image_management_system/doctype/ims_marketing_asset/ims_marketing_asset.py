# Copyright (c) 2026, surendhranath and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class IMSMarketingAsset(Document):
    """Controller for IMS Marketing Asset.

    Manages the lifecycle of marketing assets including file privacy,
    status synchronization with workflow state, and revision tracking.
    """

    def validate(self):
        self.ensure_file_is_private()

    def ensure_file_is_private(self):
        """Ensure the attached file is marked as private (is_private=1)
        until the asset reaches Approved state."""
        if not self.latest_file:
            return

        file_doc = frappe.db.get_value(
            "File",
            {"file_url": self.latest_file},
            ["name", "is_private"],
            as_dict=True,
        )

        if file_doc and not file_doc.is_private and self.status != "Approved":
            frappe.db.set_value("File", file_doc.name, "is_private", 1)

    def on_update(self):
        """Sync the status field with the workflow_state when it changes."""
        workflow_state = getattr(self, "workflow_state", None)
        if workflow_state and self.status != workflow_state:
            self.db_set("status", workflow_state)
