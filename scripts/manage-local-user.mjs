import {
  createUserRecord,
  ensureDataStore,
  findActiveUserByEmail,
  hashPassword,
  saveMapsByUser,
  savePlansByUser,
  saveSnapshotsByUser,
  saveUsers,
  withDataStoreLock,
} from '../api/_lib/store.js';

const usage = `Usage:
  npm run admin:local -- --email you@example.com --password 'new-password' [--make-admin]
  npm run admin:local -- --email you@example.com --password 'new-password' --make-admin --create [--username 'Display Name']

Options:
  --email       Required. Target user email.
  --password    Required. New password for reset or account creation.
  --make-admin  Promote the user to admin.
  --create      Create the user when it does not already exist.
  --username    Optional username used only during creation.
`;

const parseArgs = (argv) => {
  const result = {
    email: '',
    password: '',
    username: '',
    create: false,
    makeAdmin: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--create') {
      result.create = true;
      continue;
    }
    if (current === '--make-admin') {
      result.makeAdmin = true;
      continue;
    }
    if (current === '--email') {
      result.email = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (current === '--password') {
      result.password = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (current === '--username') {
      result.username = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (current === '--help' || current === '-h') {
      result.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return result;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage);
    return;
  }

  if (!options.email) {
    throw new Error('Missing required --email');
  }

  if (!options.password || options.password.length < 6) {
    throw new Error('Missing valid --password. Password must be at least 6 characters.');
  }

  const summary = await withDataStoreLock(async () => {
    const store = await ensureDataStore();
    let user = findActiveUserByEmail(store.users, options.email);
    let created = false;

    if (!user) {
      if (!options.create) {
        throw new Error('User not found. Re-run with --create to create a local account.');
      }

      user = createUserRecord({
        email: options.email,
        username: options.username,
        password: options.password,
        role: options.makeAdmin ? 'admin' : 'user',
      });

      store.users.push(user);
      store.plansByUser[user.id] = [];
      store.snapshotsByUser[user.id] = [];
      store.mapsByUser[user.id] = {};
      created = true;
    } else {
      user.passwordHash = hashPassword(options.password);
      user.updatedAt = new Date().toISOString();
      if (options.makeAdmin) {
        user.role = 'admin';
      }
    }

    await saveUsers(store.config, store.users);
    await savePlansByUser(store.config, store.plansByUser);
    await saveSnapshotsByUser(store.config, store.snapshotsByUser);
    await saveMapsByUser(store.config, store.mapsByUser);

    return {
      created,
      email: user.email,
      role: user.role,
      userId: user.id,
      storageMode: store.config.mode,
      usersPath: store.config.usersPath,
    };
  });

  console.log(JSON.stringify({
    status: 'success',
    ...summary,
  }, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'error',
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
