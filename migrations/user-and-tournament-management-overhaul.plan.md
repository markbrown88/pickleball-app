<!-- fe8238bd-26d4-4d68-8fcd-719a9c08055c 7717d948-91f0-4d02-a26e-002659e38cf4 -->
# PRD: User & Tournament Management Overhaul

This document outlines the requirements for a significant enhancement of the user account and tournament registration systems. The goal is to create a more modern, user-friendly, and scalable platform.

## 1. User Account Management

### 1.1. Account Creation & Authentication

- **Objective:** Streamline the user signup process and guide new users toward engagement.
- **Requirements:**
    - The existing authentication methods (Email/Password with 2FA, Google SSO via Clerk) will be maintained.
    - The account creation flow must be simplified and highly intuitive.
    - Upon successful account creation, the user will be presented with a final step suggesting they register for upcoming tournaments. This section should be dynamic and visually appealing.

### 1.2. Player Profile Editing

- **Objective:** Replace the current profile editing interface with a comprehensive, full-page form.
- **Requirements:**
    - A new, dedicated page at a route like `/profile/edit` will be created for editing player information.
    - This form must include all editable fields from the `Player` model in `prisma/schema.prisma`, such as `firstName`, `lastName`, `phone`, `birthday`, DUPR ratings, etc.
    - The UI must be clean, modern, and provide clear, inline validation messages for all fields.

## 2. Tournament Registration & Payments

### 2.1. Registration Cost

- **Objective:** Enable free and paid tournament registrations.
- **Requirements:**
    - The `Tournament` model will be updated to include a field for registration cost.
    - The tournament setup/creation interface will be modified to allow administrators to set this cost.

### 2.2. Payment System Architecture

- **Objective:** Lay the architectural foundation for a future-proof payment system.
- **Requirements:**
    - The database schema will be updated to support a payment system. This includes placeholder models for `Payment`, `Discount`, and `PricingTier`.
    - The system will be designed with Stripe integration in mind, but the actual payment processing will be implemented in a later phase. For now, registering for a paid tournament will simply record the intent to pay.

## 3. Player Administration

### 3.1. Roles & Permissions

- **Objective:** Define clear roles for player management.
- **Requirements:**
    - **App Admin:** The only role with the ability to manually add a new player directly.
    - **Tournament Admin:** Can invite a new player to the platform using their email address and name. This invitation can be optionally linked to a specific tournament.

### 3.2. Invitation Flow

- **Objective:** Create a seamless flow for inviting new players.
- **Requirements:**
    - A UI will be created for Tournament Admins to send invitations.
    - When an invitation is sent, an email will be triggered containing a unique link to the app.
    - If the invitation is for a specific tournament, this will be clearly stated in the email and the user will be directed to that tournament's registration page after signing up.

### 3.3. Player Disabling

- **Objective:** Implement a "soft delete" or disabling feature for players.
- **Requirements:**
    - Players will never be permanently deleted from the database. A `disabled` flag or similar status will be added to the `Player` model.
    - Disabled players will be hidden from all lists, searches, and selection UIs throughout the application for all users **except** the App Admin.
    - The App Admin will have a toggle (defaulted to 'Off') on player management screens. When toggled 'On', disabled players will appear in lists and search results, visually distinguished by being greyed-out and having a "Disabled" badge.
    - The App Admin will have the ability to re-enable a disabled player.

## 4. Data Management & Integrity

### 4.1. Duplicate Handling

- **Objective:** Prevent the creation of duplicate accounts and provide a path for resolution.
- **Requirements:**
    - During signup, if a user enters an email that already exists, the system will display a clear error message (e.g., "An account with this email already exists. Please log in.").
    - A feature will be built for the App Admin to merge two distinct player profiles into one.

### 4.2. Merging Player Profiles

- **Objective:** Allow an App Admin to consolidate duplicate player records.
- **Requirements:**
    - An admin interface will be created to select two player profiles for merging.
    - The merge logic will be designed to be extensible. For the initial implementation, the specific rules for resolving data conflicts (e.g., which phone number to keep) will be defined at a later stage, per your request. The function will be built to accommodate this future requirement.

## 5. System Communications

- **Objective:** Implement essential transactional emails.
- **Requirements:**
    - **Invitation Email:** Sent to a new user when invited by a Tournament Admin.
    - **Registration Confirmation Email:** Sent to a user upon successful registration for a tournament.

### To-dos

- [ ] Create a new dedicated page at `/profile/edit` for comprehensive player profile management, including all fields and robust validation.
- [ ] Enhance the user signup flow to include a final step that suggests relevant upcoming tournaments to the new user.
- [ ] Implement the player management UI for App Admins, featuring a toggle to show/hide disabled players.
- [ ] Build the backend API endpoints and database schema changes required to disable and re-enable players.
- [ ] Build the backend API endpoints for merging two player profiles, with extensible logic for future data conflict rules.
- [ ] Add a registration cost field to the Tournament model and update the tournament setup UI accordingly.
- [ ] Implement the "Invite Player" feature for Tournament Admins, including the UI and backend logic.
- [ ] Set up an email service and create the template for the player invitation email.
- [ ] Set up an email service and create the template for the tournament registration confirmation email.
- [ ] Update the database schema with placeholder models for `Payment`, `Discount`, and `PricingTier` to support future payment integration.