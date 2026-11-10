# Mazbay Wood - Retail Stock Management System

A web-based retail inventory and order allocation management system built for **Mazbay Wood**, a home furniture retail store operating in the United Arab Emirates (UAE). All product pricing, inventory valuations, and audit reports are calculated in UAE Dirhams (AED).

---

## Features

### 1. Stock Master & Inventory Tracking
- Real-time catalog showing SKU code, item name, category, unit price (AED), on-hand stock, allocated units, and net available units for immediate sale.
- Dynamic stock health indicators:
  - **In Stock**: Available units > 3
  - **Low Stock**: Available units between 1 and 3
  - **Out of Stock**: Available units = 0
- Instant search by item name or SKU code.
- Multi-criteria filtering by furniture category and stock availability status.

### 2. Order Allocation & Overselling Prevention
- Allocate available physical stock against customer sales orders (Order # and Customer Reference).
- **Strict Overselling Guard**: Prevents reserving more units than the currently available balance (`stockLevel - allocatedCount`).
- Allocation lifecycle management:
  - **Dispatch**: Fulfills the order, deducting units from both active reservations and total on-hand warehouse inventory.
  - **Cancel**: Releases reserved units immediately back to the available inventory balance.

### 3. Inventory Adjustments & Restocking
- **Quick Restock Modal**: Quickly record incoming shipments to increase physical on-hand quantity.
- **Physical Count Adjustment Modal**: Adjust total physical stock levels with live calculation of projected available units, enforcing that on-hand stock cannot be set lower than active order reservations.

### 4. Category Management & Dynamic SKU Generation
- Add custom furniture categories with custom SKU prefixes (e.g., `MW-LIV`, `MW-DIN`, `MW-BED`).
- Dynamic SKU generator produces sequential identifiers (e.g., `MW-LIV-001`, `MW-LIV-002`).
- Safety validation prevents deleting categories that contain active inventory items.
- Dynamic updates across all category filters and product registration forms without manual page reloads.

### 5. Financial Valuation & Audit Reporting
- Official inventory and valuation audit report summarizing:
  - Total active SKUs
  - Total units on hand
  - Total units allocated to customer orders
  - Total units available for sale
  - Total financial valuation in AED
- Category-level breakdown of SKU count, unit counts, and valuation.
- Live timestamp tracking report generation time.
- Integrated print styling and one-click PDF export.

### 6. Local Persistence
- Automatically persists all inventory items, categories, and allocation logs to browser `localStorage`.
- Includes realistic baseline seed data on initial launch.

---

## Project Structure & Architecture

The project is structured using Object-Oriented Programming (OOP) principles in TypeScript:

```
├── index.html                   # Clean semantic HTML markup
├── package.json                 # Project configuration and build scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite build configuration
├── src/
│   ├── main.ts                  # Application bootstrap and global wiring
│   ├── style.css                # Custom responsive styling and print layouts
│   ├── types/
│   │   └── inventory.ts         # TypeScript interfaces and type definitions
│   ├── models/
│   │   ├── FurnitureItem.ts     # FurnitureItem entity and stock methods
│   │   └── OrderAllocation.ts   # OrderAllocation entity and statuses
│   ├── services/
│   │   └── InventoryManager.ts  # Business logic, validation, and storage
│   └── ui/
│       └── UIManager.ts         # DOM rendering, events, modals, and toasts
└── README.md                    # Project documentation
```

### Core Classes

- **`FurnitureItem`** (`src/models/FurnitureItem.ts`): Encapsulates individual SKU data, available stock calculation (`stockLevel - allocatedCount`), allocation/deallocation actions, and financial valuation.
- **`OrderAllocation`** (`src/models/OrderAllocation.ts`): Represents a customer order reservation with status progression (`ACTIVE`, `DISPATCHED`, `CANCELLED`).
- **`InventoryManager`** (`src/services/InventoryManager.ts`): Manages collections of items, categories, and allocations. Handles CRUD actions, validation, overselling guards, and report generation.
- **`UIManager`** (`src/ui/UIManager.ts`): Handles UI rendering, tab navigation, search/filter listeners, modal dialogs, and non-blocking toast notifications.

---

## Tech Stack

- **TypeScript** (Strict mode)
- **HTML5 & CSS3** (Vanilla responsive styling with print media support)
- **Vite** (Next-generation frontend tooling and bundler)
- **Material Symbols Outlined** (Icons)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/stngz/Mazbay-Wood-Project.git
cd Mazbay-Wood-Project
npm install
```

### Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Compile TypeScript and build the production bundle:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

### Type Checking

Run the TypeScript compiler to verify type safety:

```bash
npm run lint
```

---

## License

This project was developed as an academic coursework assignment.
