# Terminal Chat App (TCA)

A terminal-based chat application that allows users to chat in rooms or direct messages (DMs) through a terminal-style interface in the browser. This app is built with a React frontend terminal emulator, a Node.js backend, WebSocket real-time communication, and stores data in MongoDB Atlas.

## Table of Contents

- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Project Structure](#project-structure)  
- [Getting Started](#getting-started)  
- [Usage](#usage)  
- [Commands](#commands) 
- [Deployment](#deployment)  
- [Contributing](#contributing)  
- [License](#license)  

## Features

- Terminal-style chat interface powered by [XTerm.js](https://xtermjs.org/)  
- Real-time messaging using [Socket.io](https://socket.io/)  
- Supports chat rooms and direct messaging  
- User authentication with JWT tokens  
- Image upload support within chats  
- Backend built with Node.js and Express  
- Data storage on MongoDB Atlas  
- Frontend hosted on Vercel  
- Backend can be deployed on Render or similar PaaS platforms  

## Tech Stack

| Layer       | Technology                    |
|-------------|------------------------------|
| Frontend    | React, XTerm.js              |
| Backend     | Node.js, Express, Socket.io  |
| Database    | MongoDB Atlas                |
| Hosting     | Vercel (Frontend), Render (Backend) or Railway (previous) |
| Other       | Yarn, dotenv                 |

## Project Structure

```
tca/
├── backend/          # Backend API and Socket.io server
├── frontend/         # React terminal UI
└── README.md         # Project documentation
```

- `backend/`  
  Contains the Node.js/Express app with REST API routes (`/api`) for authentication, rooms, uploads, as well as Socket.io logic for real-time communication.

- `frontend/`  
  Contains the React app with a terminal emulator interface built with XTerm.js. Connects to backend APIs and sockets for chat functionality.

## Getting Started

### Prerequisites

- Node.js and Yarn installed locally for development.  
- MongoDB Atlas account and cluster with connection URI.  
- Environment variables setup (see below).  

### Setup

1. Clone the repository:

```
git clone https://github.com/nixsh5/tca.git
cd tca
```

2. Backend setup:

```
cd backend
yarn install
```

Create a `.env` file in the `backend` directory with the following content:

```
MONGODB_URI=
JWT_SECRET=
PORT=5000
```

3. Frontend setup:

```
cd ../frontend
yarn install
```

Create a `.env` file in the `frontend` directory with:

```
REACT_APP_BACKEND_URL=https://your-backend-url.onrender.com
```

Replace `https://your-backend-url.onrender.com` with your actual deployed backend URL.

## Usage

### Running locally

- Start backend server:

```
cd backend
yarn start
```

- Start frontend development server:

```
cd ../frontend
yarn start
```

Open your browser at `http://localhost:3000` to access the terminal chat application.

## Commands Overview

Inside the terminal app interface, use the following commands:

| Command                   | Description                           |
|---------------------------|-------------------------------------|
| `/help`                   | Show available commands             |
| `/login  ` | Login with username and password    |
| `/listrooms`              | List existing chat rooms            |
| `/join `            | Join specified chat room            |
| `/users`                  | List users in current room          |
| `/dm `          | Start direct message with user      |
| `/exit`                   | Exit a DM or leave a room           |
| `/image`                  | Upload and send an image            |
| `/logout`                 | Log out current user                |
| `/quit`                   | Quit the terminal chat app (mock)  |

## Deployment

### Frontend

- Hosted on [Vercel](https://vercel.com/).  
- Connect your GitHub repo, configure environment variables to set `REACT_APP_BACKEND_URL`, and deploy.

### Backend

- Hosted on [Render](https://render.com/) (recommended free alternative to Railway).  
- Connect your repo’s `backend/` folder as the root directory.  
- In Render dashboard, set the following parameters:

```
Build Command: yarn
Start Command: yarn start
```

- Deploy and ensure you use the Render service URL as the backend URL in frontend environment variables.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository.  
2. Create a branch for your feature or fix.  
3. Commit your changes with clear messages.  
4. Open a Pull Request describing your changes.  

Make sure to maintain consistent coding style and test new features.


## Acknowledgments

- [XTerm.js](https://xtermjs.org/)  
- [Socket.io](https://socket.io/)  
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)  
- [Vercel](https://vercel.com/)  
- [Render](https://render.com/)  


*Made with ❤️ by Nish Deshmukh*
