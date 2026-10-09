# Preppr

Preppr is a family app for planning meals and shopping.

Menus are built with an assistant (Google Gemini or Anthropic Claude), or imported from a JSON file. Recipes and the shopping list, grouped by aisle, are shared by everyone signed in with the same account. The shopping list stays usable without a network, then syncs when the connection returns.

On first launch, you create an administrator account. That account is one household, and it can later create other households. Each household has its own recipes and its own list. People in the same household share one username.

Image: `xavlal/preppr`  
Source: [github.com/XavLal/preppr](https://github.com/XavLal/preppr)

## Install

No configuration file is required. On first start, Preppr generates the secret that signs sessions and keeps it in the data volume (`jwt-secret`). Recipes, accounts, and API keys are stored there too. The volume survives updates.

The container starts as root only long enough to fix the volume permissions, then the app runs as the user `preppr` (UID 1000). Data directories are mode `0700`, files are mode `0600`.

### With `docker run`

```bash
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

Open [http://localhost:3000](http://localhost:3000).

To use a folder on the host instead of a named volume, replace `preppr-data` with a path, for example `-v /path/to/data:/data`. That folder is assigned to UID 1000.

### With Docker Compose

Save this file as `compose.yaml`:

```yaml
services:
  preppr:
    image: xavlal/preppr:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - preppr-data:/data

volumes:
  preppr-data:
```

Then:

```bash
docker compose up -d
```

The app listens on [http://localhost:3000](http://localhost:3000).

### From a UI (NAS, Portainer, and similar)

1. Image: `xavlal/preppr:latest` (or a pinned version, for example `xavlal/preppr:0.4.0`).
2. Publish container port **3000** on a free port of the machine.
3. Mount a volume or dataset on **`/data`**.
4. Leave automatic restart enabled.
5. Start, then open `http://<machine-address>:<port>`.

### First account

The form **Create the administrator account** appears only while no account exists. It asks for the **installation code**, printed once in the logs:

```bash
docker logs -f preppr
```

With Compose, use the service name if you named it differently (`docker compose logs -f preppr`).

Look for the line `Code d'installation Preppr` (the log line stays in French). Without that code, a visitor on the network cannot become the administrator. The code is deleted as soon as the account is created.

1. Open the Preppr address.
2. Copy the installation code.
3. Choose a username: letters, digits, and hyphens.
4. Choose a password of at least 12 characters, and confirm it.
5. Submit. This first account’s session lasts 30 days.

### Other households

Signed in as the administrator: **Settings → Household accounts**.

1. Enter the username of the new household.
2. Enter an initial password of at least 12 characters.
3. Pass the username and password on yourself.

Two usernames that normalize the same way (`Famille A` and `famille-a`) cannot both exist: the second one is rejected. Each household has its own recipes and list. The administrator does not see them. Other accounts cannot create households.

The same creation works without the browser. The first account created this way is the administrator; later ones are ordinary households.

```bash
docker exec -it preppr node server/dist/cli/add-user.js
```

The prompts are in French: `Identifiant (famille)` and `Mot de passe`.

### Passwords

Each person changes their own password under **Settings → My account**. Other devices signed in to that account then need to sign in again.

The administrator resets another household’s password from **Household accounts**. That household’s devices are signed out. The new password can also be used to sign in there: it is meant to help someone who forgot theirs.

There is no email “forgot password”. If the administrator forgets theirs, access to the machine is the proof. Interactive mode keeps the password out of the shell history:

```bash
docker exec -it preppr node server/dist/cli/reset-password.js
```

The prompts are in French: `Identifiant` and `Nouveau mot de passe`.

On one line (the password stays in the shell history):

```bash
docker exec preppr node server/dist/cli/reset-password.js family new-password-here
```

A new password must be at least 12 characters. A password already stored, even if shorter, keeps working until it is changed.

### Change the port

In `docker run`, replace `3000:3000` with `8080:3000` to publish Preppr on port 8080 of the machine. The number on the right stays **3000**: that is the port inside the container.

In Compose:

```yaml
ports:
  - "8080:3000"
```

### Set the session secret yourself

With no setting, the secret is created in `/data/jwt-secret` and reused on later starts. If it changes, everyone must sign in again; recipes and the list stay in place.

To set one yourself:

```bash
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

Keep that value: it takes precedence over the `jwt-secret` file.

### Update

The data volume is kept.

```bash
docker pull xavlal/preppr:latest
docker stop preppr
docker rm preppr
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

With Compose, from the folder that holds the file:

```bash
docker compose pull
docker compose up -d
```

To choose when to update, pin a version (`xavlal/preppr:0.4.0`) instead of `latest`.

An install that was still using the old fallback secret `change-me-in-production` receives a real secret on update: one sign-in is required.

### Back up

Files live in the volume mounted on `/data`:

```text
/data/accounts.json
/data/jwt-secret
/data/tenants/<username>/state.json
/data/tenants/<username>/history/
```

`accounts.json` holds usernames and password hashes. `jwt-secret` signs sessions when no `JWT_SECRET` is set: back it up with the rest, or everyone will have to sign in again. `state.json` is the current state (recipes, shopping, settings, API keys). The `history/` folder keeps up to 50 automatic copies of that state.

There is no restore screen. To go back, stop the container, replace `state.json` with a copy from `history/`, then start it again.

```bash
docker stop preppr
mkdir -p backup
docker cp preppr:/data/. ./backup
docker start preppr
```

`docker rm` removes the container, not the named volume `preppr-data`. `docker volume rm preppr-data` deletes the data.

### Environment variables

| Variable | Role | Value when unset |
| --- | --- | --- |
| `JWT_SECRET` | Session signature | Secret generated in `/data/jwt-secret` |
| `PORT` | Port the container listens on | `3000` |
| `DATA_DIR` | Folder for accounts and households | `/data` |

### Access from a phone

On the local network, open `http://<machine-ip>:3000` (or the published port).

To install Preppr on the home screen, the browser usually requires an **HTTPS** address, except on `localhost`. Put Preppr behind your NAS or router reverse proxy, on the same origin as the API. The in-app guide is under **Settings → How to install the app (Android and iPhone)**.

Gemini and Claude keys are entered in **Settings**, after signing in. They are stored with the household’s data. Calls to the AI leave the browser for Google or Anthropic: phones and computers that generate menus need Internet access. The shopping list does not need these keys.

## Use

The top bar has three entries: **Recipes** (the plan), **Shopping** (the list by aisle), and the assistant icon (the menu generator). The **☰** menu contains **Settings** and **Log out**. Logging out also clears this household’s local copy on the device.

The interface is in French or English. The language choice stays on the device.

### Sign in

1. Open the Preppr address.
2. If no account exists yet, follow [First account](#first-account). Otherwise, enter the household username and password.
3. Leave **Remember me** checked on a personal phone or computer (30-day session). Uncheck it on a shared device (8-hour session).

### Set up the assistant

1. Open **☰ → Settings**.
2. Under **AI model**, choose **Google Gemini** or **Anthropic Claude**.
3. Create a key with the provider (the links are on the page) and paste it. It is saved automatically.
4. Under **User context**, describe the household: number of people, allergies, equipment, and how the assistant should suggest meals. These texts are sent with every conversation.

**Reset preferences to defaults** also clears the API keys.

**Aisle order** lines the list up with the path through your store. The arrows move an aisle up or down. **Reset aisle order** restores the original order.

### Generate menus

Open the assistant (the icon at the top, or **Generate my menus** when the plan is empty).

1. Say how many meals you want, any particular meal, and the constraints for this time (time available, what is left in the fridge).
2. **Send**. Enter sends the message. Shift+Enter starts a new line. The paperclip attaches a photo (handwritten list, fridge, cupboard).
3. Pick from the suggested recipes. The assistant suggests more until the requested number is reached, then produces a recipe file.
4. As soon as that file is valid, Preppr imports it: the dishes appear under **Recipes**, the ingredients under **Shopping**. A banner confirms the import.

The refresh button next to the title starts a new conversation. The chat history stays on the device. Imported recipes are on the server, shared by the household.

**Recipes → Import from JSON** adds recipes written elsewhere. The import does not replace recipes already there. The format is described in the repository: [JSON format](https://github.com/XavLal/preppr/blob/main/docs/format-json.md).

### Recipes

The home page summarizes what is still to cook, what is already cooked, what is still to buy, and what is already checked.

On each card:

- the title opens the recipe;
- **Already done** marks the dish as cooked;
- the arrows change the order;
- **Remove** takes the dish off the plan.

**Remove** becomes available only after **Already done**. Removing also takes the ingredients off the list, except lines entered by hand.

**Delete all recipes** (at the bottom of the page) asks for confirmation and a connection. Ingredients added by hand on the shopping list are kept.

On the recipe page:

- **Servings** goes from 1 to 24. Ingredient quantities and the shopping list follow. The recipe’s base amounts do not change.
- The pencil edits the title, link, times, ingredients, and steps.
- The link next to the source opens the original page when a URL was provided.

**Add a recipe manually** is for a home dish. One line per ingredient (`2 tomatoes`, `200 g pasta`), one line per step.

### Shopping list

Recipe ingredients are grouped by aisle, and added together when the name, unit, and aisle match.

1. Check an item once it is in the cart.
2. **Remove** on a line is available only after it is checked.
3. **Add an ingredient** creates a line marked **Manual**. The **+** button next to an aisle fills that aisle in.
4. Tap the line to edit the name, quantity, unit, or aisle.
5. Inside an aisle, the **⋮** handle or the arrows change the order.

Items that are not part of a recipe and came from an import carry the **Extra** badge.

- **Print** opens the browser print dialog.
- **Remove checked items** drops what is already bought and leaves the rest.
- **Clear the whole list** removes every line. Recipe pages stay. This action requires a connection.

Units: `g`, `kg`, `ml`, `cl`, `L`, `tbsp`, `tsp`, `piece`, `pinch`.

Aisles: Fruit & vegetables, Meat & fish, Dairy & chilled, Savory groceries, Sweet groceries, Bakery, Frozen, Drinks, Health & beauty, Other.

### Offline

When the network is missing, an **Offline** badge appears. The last known copy of the household stays readable.

On the shopping list (check, add, edit, remove an item that is already checked) and on servings, changes are kept on the device. The **To sync** badge means they have not been sent yet. When the network returns, Preppr sends them. If someone else changed the data in the meantime, the device’s shopping list and servings are brought back to the latest server version.

**Delete all recipes** and **Clear the whole list** require being online, with no sync waiting.

### On a phone

**Settings → How to install the app (Android and iPhone)** spells out the gestures.

- Android, Chrome: **⋮** menu, then **Install app** or **Add to Home screen**.
- iPhone or iPad, Safari: **Share**, then **Add to Home Screen**.

Once installed, Preppr opens like an app. Installing from a remote phone works over HTTPS. Locally, `http://localhost` is enough on the machine that hosts Preppr.
