const keytar = require("keytar");
const Configstore = require("configstore");

const CONFIGSTORE_EMAIL_KEY = "ethernal.email";
const KEYCHAIN_NAMESPACE = "ethernal:firebase";

const configstore = new Configstore(CONFIGSTORE_EMAIL_KEY);

module.exports = {
  getEmail: async () => {
    return process.env.ETHERNAL_EMAIL ? await new Promise((resolve) => resolve(process.env.ETHERNAL_EMAIL)) : await configstore.get(CONFIGSTORE_EMAIL_KEY);
  },
  getPassword: async (email: string) => {
    return process.env.ETHERNAL_PASSWORD ? await new Promise((resolve) => resolve(process.env.ETHERNAL_PASSWORD)) : await keytar.getPassword(KEYCHAIN_NAMESPACE, email);
  },
};
