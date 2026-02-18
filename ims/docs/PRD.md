

---

# **Product Requirement Document (PRD):IMS**

## **1\. Project Overview**

**IMS** is a dedicated lifecycle management system for marketing collateral. It centralizes the journey of an image from a designer's export to a final, approved, and hosted asset ready for social media or official distribution.

The app and doppio dashboard are created as follows: **ims** is the app and **ims-dashboard** is the doppio react, typescript app.

### **The Problem**

* **Feedback Fragmented:** Revisions happen across email, Slack, and verbal chats.  
* **Version Control:** Confusion over which "Final\_v2\_RealFinal.png" is actually approved.  
* **Storage Bloat:** Massive marketing files clogging local server space without a cloud strategy.

### **The Solution**

A unified dashboard where assets are uploaded, reviewed via visual annotations, and automatically moved to cloud storage upon final sign-off.

---

## **2\. User Personas**

| Persona | Role | Primary Goal |
| :---- | :---- | :---- |
| **Graphic Designer** | Creator | Upload assets and track feedback/approval status. |
| **Peer Reviewer** | Quality Check | Ensure technical specs (size/res) are met before the HOD sees it. |
| **Dept. Head (HOD)** | Functional Lead | Approve content for brand alignment and strategy. |
| **CMO/Brand Lead** | Final Authority | Give the green light for public release. |

---

## **3\. Phase-Wise Feature Roadmap**

### **Phase 1: The Governance Foundation (The "Engine")**

*Focus: Establishing the data structure, core workflow, and basic UI using frappe-ui.*

* **DocType Architecture:**  
  * **IMS Marketing Asset:** The master record containing metadata (Campaign, Owner, Expiry).  
  * **IMS Asset Revision:** A child table or linked DocType that stores every version of the file, preventing the loss of previous drafts.  
* **The Approval Workflow:**  
  * Native Frappe Workflow integration: Draft $\\rightarrow$ Peer Review $\\rightarrow$ HOD Approval $\\rightarrow$ Final Sign-off $\\rightarrow$ Approved.  
  * Strict Role-Based Access Control (RBAC): Only the CMO can trigger the "Final Sign-off" to "Approved" transition.  
* **Secure File Handling:**  
  * All uploads are set to is\_private \= 1 by default to ensure only authenticated users can view pre-approved assets.  
* **Basic Asset Gallery:**  
  * A frappe-ui list view displaying thumbnails, current status, and the assigned reviewer.

---

### **Phase 2: The Collaborative Workspace (The "Experience")**

*Focus: Enhancing the developer/user interaction via Doppio and visual feedback tools.*

* **Kanban Workflow Dashboard:**  
  * A custom frappe-ui board where cards (assets) are dragged across stages. Dragging a card triggers a backend workflow transition.  
* **Visual Annotation Tool:**  
  * A React/Vue-based canvas overlay on the image. Approvers can click on a specific area of a graphic to leave a "sticky note" style comment.  
  * *Feature:* "Highlight red area for color correction."  
* **Threaded Comments:**  
  * A sidebar in the SPA showing a chronological feed of comments tied to specific revisions.  
* **Real-time Activity Stream:**  
  * Utilizing **Socket.io (Frappe Realtime)** to show toast notifications when an asset is assigned to a user or rejected.

---

### **Phase 3: Enterprise Scale & Automation (The "Scale")**

*Focus: Cloud integration, analytics, and lifecycle automation.*

* **Automated S3 Offloading:**  
  * A server-side hook (on\_update) that detects the Approved state.  
  * The system moves the file from local storage to an S3 bucket (AWS/Google Cloud) and updates the file\_url to the CDN link.  
* **Asset Analytics:**  
  * A dashboard showing **TAT (Turnaround Time)**: How long an asset stays in "HOD Approval" vs "Final Sign-off."  
  * Rejection rate tracking to identify bottlenecks in the creative process.  
* **Expiry & Compliance Engine:**  
  * A daily cron job that checks expiry\_date.  
  * If an asset is 7 days from expiring, the system notifies the creator to archive or renew.  
* **Public CDN Link Generator:**  
  * A single-click button to copy the final, public-facing URL for use in social media schedulers like Hootsuite or Buffer.

---

## **4\. Technical Specifications**

### **4.1 Frontend Tech Stack (Doppio SPA)**

* **Framework:** Vue 3 / React (User choice via Doppio).  
* **UI Library:** frappe-ui (provides the Button, Dialog, Input, and Popover components).  
* **State Management:** Pinia or Zustand for managing the active asset state across the dashboard.

### **4.2 Backend API Contract (Custom RPC)**

* ims.api.v1.get\_dashboard\_summary: Aggregates asset counts by status.  
* ims.api.v1.add\_annotation: Saves X/Y coordinates and comment text to the IMS Revision Comment table.  
* ims.api.v1.publish\_asset: Manually triggers S3 offloading if not automated.

---

## **5\. Non-Functional Requirements**

* **Performance:** Image thumbnails must lazy-load in the gallery to prevent lag with high-res files.  
* **Security:** Full audit trail for every status change (who, when, and what comment was made).  
* **Scalability:** Support for multi-part file uploads for assets exceeding 100MB (Videos/Large PSDs).

---

## **6\. Success Metrics**

* **Time-to-Publish:** Reduce the average approval cycle from days to hours.  
* **Version Accuracy:** 100% of published assets match the final approved revision.  
* **Centralization:** Zero marketing assets stored on local designer machines or personal Google Drives.

---

### **What I can do for you next**

Would you like me to **generate the boilerplate code for the ims\_marketing\_asset.py controller**, including the workflow transition logic and the file upload validation?

