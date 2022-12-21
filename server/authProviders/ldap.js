const ldap = require('ldapjs');
const Logger = require('../Logger');
const { res } = require('../libs/dateAndTime');
const { integer } = require('../libs/requestIp/isJs');

class LdapAuth {
  constructor() {}
  async getClient() {
    return await new Promise((resolve, reject) => {
      Logger.debug('Connecting...')
      const client = ldap.createClient({
        url: global.ldapUrl,
        bindDN: global.ldapBindUser,
        bindCredentials: global.ldapBindPass
      });
      let onError, onConnect, onTimeout;
      onError = err => {
        Logger.error('Error Connecting.')
        client.removeListener('connect', onConnect);
        reject(err);
      };
      onConnect = () => {
        Logger.debug('Connected.')
        Logger.debug('Binding...')
        client.removeListener('error', onError);
        client.bind(global.ldapBindUser, global.ldapBindPass, err => {
          if (err) {
            Logger.error('Error Binding.')
            reject(err);
          }
          else {
            Logger.debug('Bound.')
            resolve(client);
          }
          
          // client.search
        })
      };
      onTimeout = () => {
        Logger.error('Timeout Connecting.')
        reject(new Error('LDAP connection timeout'));
      }
      client.once('connect', onConnect)
      client.once('error', onError)
      client.once('connectTimeout', onTimeout)
    })
  }
  async findAllUsers() {
    const client = await this.getClient();
    return await new Promise((resolve, reject) => {
      Logger.info('Searching...')
      Logger.debug(`global.ldapBaseDn: ${global.ldapBaseDn}`)
      Logger.debug(`global.ldapSearchFilter: ${global.ldapSearchFilter}`)
      client.search(global.ldapBaseDn, {
        scope: 'sub',
        filter: global.ldapSearchFilter
      }, (err, res) => {
        Logger.info('Search returned.')
        const items = []
        Logger.debug('Attaching to entry events...')
        res.on('searchEntry', entry => {
          Logger.debug('adding entry...')
          items.push(entry.object)
        })
        Logger.debug('Attaching to error events...')
        res.on('end', result => {
          Logger.debug('end of entries.')
          Logger.info(`Search complete, returning ${items.length} items.`)
          resolve(items);
        })

      })
    })
  }
  authenticateUser(username, password) {
    Logger.info('Authenticating LDAP User...');
    return new Promise((resolve, reject) => {
      const tempClient = ldap.createClient({
        url: global.ldapUrl,
        bindDN: username,
        bindCredentials: password
      })
      let onError, onConnect, onTimeout;
      onError = err => {
        Logger.error('Error Connecting.')
        tempClient.removeListener('connect', onConnect);
        resolve(false);
      };
      onConnect = () => {
        Logger.debug('Connected.')
        Logger.debug('Binding...')
        tempClient.removeListener('error', onError);
        tempClient.bind(username, password, err => {
          if (err) {
            Logger.error('Error Binding.')
            resolve(false);
          }
          else {
            Logger.debug('Bound.')
            tempClient.unbind(err => {
              if (err) {
                Logger.error('Error Unbinding.')
                resolve(false);
              } else {
                Logger.info('User Authenticated.')
                resolve(true);
              }
            })
          }
          // client.search
        })
      };
      onTimeout = () => {
        Logger.error('Timeout Connecting.')
        resolve(false);
      }
      tempClient.once('connect', onConnect)
      tempClient.once('error', onError)
      tempClient.once('connectTimeout', onTimeout)
    });
  }
  
}
module.exports = new LdapAuth()