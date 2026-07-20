/// <reference path="../../../../static/js/types.js" />

/**
 * Handler pour le module Ordoscan
 * @extends {AppManagers.ViewHandler}
 */
class OrdoscanHandler extends AppManagers.ViewHandler {
  constructor() {
    super('viewOrdoscan');
  }

  async onload() {
  }
}

new OrdoscanHandler().register();