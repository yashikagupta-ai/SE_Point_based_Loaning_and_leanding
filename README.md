# ItemLend — Peer-to-Peer Item Lending Platform

Students post items they want to lend out. Borrowers pay points to borrow them. When the borrow period ends, the points are returned to the lender (plus a small platform fee based on the borrower's trust score).

## How It Works

1. **Post an item** – List something you're willing to lend (e.g. camera, lab coat, guitar). Set how many points you want in exchange.
2. **Browse & approve** – Other students browse item posts and click "Lend Points" to approve a borrow.
3. **Return** – When the item is returned, points flow back. Late returns incur a small fee.

## Project Structure

```
ItemLend/
├── Backend/          Node.js + Express + MongoDB
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── services/
└── frontend/         React + TypeScript + Tailwind
    └── src/
        ├── pages/
        ├── components/
        └── services/
```

## Key Features

| Feature | Description |
|---|---|
| Item Market | Browse and post item borrow requests |
| Points Wallet | Buy points with money (simulated), transfer between users |
| Trust Score | Score improves with on-time returns; controls your borrow limit & fee rate |
| Chat System | Send chat requests; both users must accept before messaging |
| KYC Verification | Admin-verified IDs required to post borrow requests |
| Real-time Messaging | Socket.io powered live chat between accepted connections |

## Setup

### Backend
```bash
cd Backend
npm install
cp .env.example .env
npm start
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
