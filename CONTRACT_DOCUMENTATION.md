# Facility Management System (FMS) - Contract Module Developer Guide

This document provides a comprehensive technical guide to the **Contract Lifecycle Management Module** within the Facility Management System. It is designed to help another developer understand the business model, data schemas, code architecture, workflow transitions, and implementation rules.

---

## 1. Business Logic & Domain Model

The FMS utilizes a **room-based commercial contract** model. The core architectural rules of this module are:

1. **Contracts Do Not Own Tenants**: Contracts commercially assign rooms or beds to a client company. They do not own or manage individual tenant records.
2. **Contracts Do Not Own Rooms**: A room exists independently of any contract. A contract merely reserves a room's occupancy capacity for a client company for a specified time frame.
3. **ContractAllocation is the Single Source of Truth**: Commercial ownership and reservation of rooms/beds are defined solely by active records in the `contract_allocations` collection. The legacy `company_assigned_rooms` table is deprecated (though maintained via backend fallbacks for backward compatibility).
4. **No Bulk Writes on Rooms**: The application does not write or duplicate assignment states directly to the `building_rooms` documents when status changes occur. Instead, room occupancy status, company assignment, and contract associations are resolved dynamically via database aggregates and joins.

---

## 2. Key Entities & Database Schemas

### A. Contract (`contracts` collection)
Defines the client commercial agreement, rate structures, validity period, and renewal constraints.

* **Important Fields**:
  * `contract_number`: Unique alphanumeric identifier per client.
  * `company_id`: Reference to the client company (`companies`).
  * `start_date` / `end_date`: Contract validity period.
  * `status`: Dynamic & stored state (`Draft`, `Approved`, `Active`, `Expiring Soon`, `Expired`, `Suspended`, `Terminated`, `Renewed`, `Scheduled`).
  * `renewedFromContractId` / `renewedToContractId`: References to adjacent nodes in the renewal chain.
  * `isRenewal` / `renewalVersion`: Tracks if it is a renewal and the current version depth.
  * `extensions`: Sub-document array logging validity extensions.
    * `previous_end_date`, `new_end_date`, `extension_reason`, `document_id` (reference to `contract_documents`), `extended_by`, `extended_at`.

### B. ContractAllocation (`contract_allocations` collection)
Represents the commercial reservation of a physical asset (Room, Bed, Building, Floor) under a contract.

* **Important Fields**:
  * `contract_id`: Reference to the associated contract.
  * `company_id`: Reference to the client company.
  * `allocation_type`: `ROOM`, `BED`, `BUILDING`, `FLOOR`, or `HEADCOUNT`.
  * `site_id` / `building_id` / `floor_id` / `room_id` / `bed_id`: References to the physical inventory hierarchy.
  * `quantity`: The capacity or headcount allocated.
  * `rate`: Commercial rate agreed upon for this allocation.
  * `start_date` / `end_date`: Duration of the allocation.
  * `status`: `Active`, `Expired`, `Suspended`, `Cancelled`.

---

## 3. Workflow Transitions & Lifecycle Rules

The state transitions of a contract are strictly gated by business rules:

```
Draft --> Approved --> Active --> Expired/Renewed/Terminated
```

### A. Draft ➔ Approved
* **Rules**: Requires approval action by an authorized user (Coordinator).
* **Guards**: Input validation (dates, rates, company sanity checks).

### B. Approved ➔ Active
* **Rules**: A contract cannot transition to `Active` until its commercial allocations are established.
* **Guards**: The total allocated rooms count must meet or exceed the contract's defined `room_count`. The frontend redirects the user to the Assign Rooms page if allocations are insufficient.

### C. Validity Extension
* **Rules**: Extends the validity period of the current contract in-place.
* **Guards**:
  * Blocked if a future renewal contract (`renewedToContractId` is not null) already exists.
  * New end date must be strictly after the current end date.
* **Mechanism**:
  1. Uploads the addendum PDF to the `contract_documents` collection.
  2. Pushes a new history item into the contract's `extensions` array.
  3. Updates the contract's `end_date` in-place.
  4. Automatically extends the `end_date` of all active `contract_allocations` associated with this contract.

### D. Contract Renewal (Advance & Immediate)
* **Rules**: Creates a new contract version linked to the current one.
* **Guards**:
  * Allowed only if the contract is within its notice period renewal window (default: 60 days before expiry) or already expired.
  * Blocked if the contract has already been renewed (`renewedToContractId` is already set).
* **Allocations Copying**:
  * Allocations are selectively copied to the new contract.
  * **Occupancy Check**: If a room is excluded during renewal, the system checks if there are active tenants currently checked into that room. If so, it blocks the renewal and forces the user to resolve occupancy first.
  * **Overlap Validation**: Ensures the selected rooms do not have other active allocations overlapping the new contract's range.
* **Mechanism**:
  1. Creates the new contract document with `status = "Scheduled"` (if start date is in the future) or `status = "Draft"`.
  2. Links the old contract's `renewedToContractId` to the new contract's ID.
  3. Creates new `ContractAllocation` records cloned from the selected old allocations.

### E. Termination
* **Rules**: Terminates the contract immediately.
* **Guards**: All rooms must be completely unassigned and vacant (no active allocations or tenants) before the contract can be terminated.

---

## 4. Codebase Directory Map

### Backend (Server)
* **Routes**: `src/presentation/routes/contract.routes.ts`
  * Registers API endpoints and maps permissions (e.g. `manage_contract_allocations`).
* **Controllers**: `src/presentation/controllers/contract.controller.ts`
  * Handles HTTP requests, extracts search parameters (like `include_renewed`), and formats JSON responses.
* **Use Cases**: `src/application/use-cases/contract.use-case.ts`
  * Orchestrates business flows, validates data parameters, and initiates transactional operations.
* **Validators**: `src/application/validators/contract.validator.ts`
  * Implements Joi validation rules for contract creation, extension, and renewals.
* **Models**:
  * `src/infrastructure/persistence/models/contract.model.ts`: Contract schema & status helper (`resolveStatus`).
  * `src/infrastructure/persistence/models/contract-allocation.model.ts`: Allocations schema.
* **Repositories**:
  * `src/infrastructure/persistence/mongo-contract.repository.ts`: Handles Mongoose DB operations for contracts, dynamic status calculations, and renewal allocations validation.
  * `src/infrastructure/persistence/mongo-contract-allocation.repository.ts`: Manages allocation CRUD operations and fallbacks to legacy `company_assigned_rooms` records.

### Frontend (Client)
* **Pages**:
  * `src/pages/contracts/Contracts.jsx`: General listing page with search, sorting, and dynamic status filters.
  * `src/pages/contracts/ContractDetail.jsx`: Detail view including the **Renewal Chain & Version History** panel, allocations table, documents, timeline events, and extensions log.
* **Components**:
  * `src/pages/contracts/components/ContractRenewalWizard.jsx`: 5-step wizard managing selective room duplication and tenant-safety checks.
  * `src/pages/contracts/components/ContractExtensionWizard.jsx`: 3-step wizard handling validity dates and addendum PDF uploading.
* **Redux / APIs**:
  * `src/features/contracts/contractSlice.js`: Manages Redux state mapping and contract entity updates.
  * `src/features/contracts/contractThunk.js`: Asynchronous Thunk actions.
  * `src/features/contracts/contractAPI.js`: Axio request configurations.

---

## 5. API Reference Endpoints

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/contracts` | Fetches a paginated list of contracts. Excludes old renewed contracts by default. | `page`, `limit`, `status`, `search`, `include_renewed` (boolean string) |
| **GET** | `/api/contracts/:id` | Fetches details for a specific contract. | — |
| **POST** | `/api/contracts` | Creates a new contract in `Draft` state. | Body: contract payload |
| **PUT** | `/api/contracts/:id` | Updates a contract's metadata or status. | Body: update payload |
| **POST** | `/api/contracts/:id/renew` | Renews the contract. Creates a linked renewal contract. | Body: `RenewContractRequest` |
| **POST** | `/api/contracts/:id/extend` | Extends validity end date in-place. | Body: `new_end_date`, `extension_reason`, `document_id` |
| **GET** | `/api/contracts/:id/extensions` | Retrieves validity extension logs from activity trails. | — |
| **GET** | `/api/contracts/:id/allocations` | Fetches allocations for this contract (uses fallback to legacy if needed). | — |
| **GET** | `/api/contracts/:id/occupancy-summary` | Dynamic room occupancy metrics (total slots, active, vacant). | — |
| **POST** | `/api/contracts/:id/terminate`| Terminates the contract. | Body: `reason` |

---

## 6. Developer Guidelines for Future Enhancements

* **Preserve the Chain**: Always set `renewedToContractId` on the predecessor contract during renewals. Do not let chains break.
* **Do Not Edit Historical Allocations**: When a contract is renewed, duplicate the allocations as new rows with the new `contract_id` and the renewed date boundaries. Do not update or alter the predecessor's allocations.
* **Keep dynamic status checking**: Do not rely strictly on `status` strings stored in MongoDB when resolving if a contract is currently active. Always check `end_date < now` dynamically in queries or code logic, as dates change dynamically due to the passage of time.
* **Maintain legacy fallbacks**: When adding new queries on room assignments, remember to query/aggregate from `ContractAllocation` first and union with `CompanyAssignedRoom` where applicable to preserve functionality for older, non-migrated clients.
