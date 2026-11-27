# Running the bakery on Oracle Cloud (free)

The whole shop on one Always Free Oracle server: the app, its own Postgres
database (no more Supabase, and nothing that pauses), and Caddy for HTTPS.
Every merge to `main` deploys itself. Cost: ₹0 a month within the Always Free
limits.

```
 customers' phones ──https──▶ Caddy (HTTPS) ──▶ app (Next.js) ──▶ Postgres
                              └──────────── one Oracle server ───────────┘
 photos: Cloudinary (unchanged)
```

---

## 1. Create the server (Oracle console)

1. **☰ → Compute → Instances → Create instance**, in your home region (India South, Hyderabad).
2. **Name:** `bakery`.
3. **Image and shape → Edit:**
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere → VM.Standard.A1.Flex**, **2 OCPUs, 12 GB memory**. That's half the free allowance, and plenty for the shop.
   - If it says *out of capacity*, try again later or on another day. It's common, and it clears.
4. **Networking:** *Create new virtual cloud network*, **public subnet**, **Assign a public IPv4 address: Yes**.
5. **Add SSH keys:** *Generate a key pair for me* → **Save private key**. Keep that file safe; it's the only way into the server.
6. **Boot volume:** 50 GB is enough (up to 200 GB is free in total).
7. **Create**, wait for *Running*, and note the **Public IP address**.

**Open the web ports:** on the instance page, click the **Subnet** → its **Security List** → **Add Ingress Rules**:

| Source CIDR | Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

**Recommended:** **upgrade the account to Pay As You Go** (☰ → Billing → Upgrade). It still costs **₹0** while you stay in Always Free, but Oracle then stops reclaiming free servers that look idle. Add a **budget alert** of ₹1 under Billing → Budgets, so you'd know instantly if anything ever cost money.

## 2. Connect from your PC

In PowerShell (use your key file and IP):

```powershell
ssh -i C:\path\to\ssh-key.key ubuntu@<public-ip>
```

If Windows complains the key is "too open", right-click the key file → Properties → Security → Advanced → *Disable inheritance* → remove everyone except yourself.

## 3. Let the server read the code (private repo)

On the server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_read -N "" -C "bakery server"
printf 'Host github.com\n  IdentityFile ~/.ssh/github_read\n' >> ~/.ssh/config
cat ~/.ssh/github_read.pub
```

On GitHub: **Bakery → Settings → Deploy keys → Add deploy key**. Title it `oracle server`, paste the key, and leave **write access off**. Then:

```bash
git clone git@github.com:poorna-24/Bakery.git ~/Bakery
```

## 4. Set the server up (one time)

```bash
~/Bakery/deploy/oracle/setup.sh
exit
```

Connect again (step 2) so Docker works without `sudo`.

## 5. The server's settings

```bash
cp ~/Bakery/deploy/oracle/env.example ~/Bakery/.env
nano ~/Bakery/.env
```

Fill every value as the comments say. In particular:

- **DOMAIN:** your public IP with dashes, plus `.sslip.io` (e.g. `140-238-10-20.sslip.io`). It's free and gets real HTTPS. Use your own domain instead if you buy one.
- **New** `SESSION_SECRET` and `POSTGRES_PASSWORD`: `openssl rand -hex 48`.
- Keep `'single quotes'` around anything with a `$` in it.

Save with **Ctrl+O, Enter**, then exit with **Ctrl+X**.

## 6. First start, and the menu

```bash
~/Bakery/deploy/oracle/deploy.sh
```

The first build takes a few minutes. The database starts **empty**. Either:

- **Load the sample menu** (categories, cakes, sizes and prices), then edit, delete and add in the dashboard:

  ```bash
  cd ~/Bakery && docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml \
    --profile setup run --rm migrate npm run db:seed
  ```

- **Or start empty**, and add your own categories and items in the dashboard.

*Only if you have a menu in Supabase you want to keep:* copy it over instead (Supabase → **Connect** → *Session pooler*, port 5432):

```bash
SUPABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' \
  ~/Bakery/deploy/oracle/import-from-supabase.sh
```

Open `https://<your DOMAIN>` (the menu) and `https://<your DOMAIN>/admin`. The first visit may take a few seconds while the HTTPS certificate is issued.

## 7. Deploy on every merge to `main`

On the server, create a key that is only allowed to run the deploy:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N "" -C "github actions deploy"
echo "command=\"$HOME/Bakery/deploy/oracle/deploy.sh\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat ~/.ssh/github_actions.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions        # → secret ORACLE_SSH_KEY
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/<public-ip>/"   # → secret ORACLE_KNOWN_HOSTS
```

(In the last line, put your real IP in place of `<public-ip>`.)

On GitHub, go to **Bakery → Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `ORACLE_SSH_KEY` | the private key printed above (all lines) |
| Secret | `ORACLE_KNOWN_HOSTS` | the `ssh-keyscan` line |
| Secret | `ORACLE_HOST` | the public IP |
| Variable | `ORACLE_DEPLOY` | `on` |

From now on, merging the `qa → main` PR updates the server within minutes. Watch it under **Actions → Deploy to Oracle**.

## 8. Switch over

1. **New QR codes:** in the dashboard, open **QR code** on the *new* address and print fresh table cards.
2. In Vercel, **Settings → Domains**: either keep the old address and redirect it to the new one, or pause the Vercel project once the cards are replaced.
3. Once you're happy, delete the Supabase project.

---

## Day to day

| What | How |
|---|---|
| Release | merge `qa → main` on GitHub (deploys itself) |
| Deploy by hand | `~/Bakery/deploy/oracle/deploy.sh` |
| See logs | `cd ~/Bakery && docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml logs -f app` |
| Back up now | `~/Bakery/deploy/oracle/backup.sh` (runs itself nightly at 02:30, keeps 14 days in `~/bakery-backups`) |
| Copy backups to your PC | `scp -i C:\path\to\ssh-key.key "ubuntu@<public-ip>:bakery-backups/*.gz" .` |
| Restore a backup | see the top of `backup.sh` |

QA stays on Vercel previews (`bakery-git-qa-…`), so testing still works as before. Give QA its own database later if you like.
