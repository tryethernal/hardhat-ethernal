const keytar = require('keytar');
const Configstore = require('configstore');

const CONFIGSTORE_EMAIL_KEY = 'ethernal.email';
const KEYCHAIN_NAMESPACE = 'ethernal:firebase';

const configstore = new Configstore(CONFIGSTORE_EMAIL_KEY);

module.exports = {
    getEmail: async () => {
        return await configstore.get(CONFIGSTORE_EMAIL_KEY);
    },
    getPassword: async (email: string) => {
        return await keytar.getPassword(KEYCHAIN_NAMESPACE, email);
    }
};
