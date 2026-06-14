/**
 * Handler pour la vue préparatoire
 * @extends {AppManagers.ViewHandler}
 */
class ViewPreparatoire extends AppManagers.ViewHandler {
    constructor() {
        super('viewPreparatoire');
    }
    async onload() {
        AppManagers.log('viewPreparatoire','info', 'onload étendu');
    }
}
new ViewPreparatoire().register();