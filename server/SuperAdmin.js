'use strict';

// see: https://github.com/simov/express-admin

const admin = require('express-admin');
const path = require('path');
const absoluteDBPath = path.resolve(process.cwd(), process.env.DB_FILE);
const absoluteSettingsPath = path.resolve(__dirname, 'super_admin', 'settings.json');
const absoluteCustomViewsPath = path.resolve(__dirname, 'super_admin', 'custom.json');

module.exports.superAdminRouter = admin({
    config: {
        sqlite: { database: absoluteDBPath },
        admin: { settings: absoluteSettingsPath, root: '/super_admin' },
    },
    settings: require(absoluteSettingsPath),
    users: {
        admin: {
            name: 'admin',
            pass: process.env.ADMIN_PASSWORD,
        },
    },
    custom: require(absoluteCustomViewsPath),
});
