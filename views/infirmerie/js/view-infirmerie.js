/**
 * Handler pour la vue Infirmerie
 * @extends AppManagers.ViewHandler
 * */
class ViewInfirmerie extends AppManagers.ViewHandler {
    constructor() {
        super('viewInfirmerie');
    }
    async onload() {
        AppManagers.log('viewInfirmerie', 'info', 'onload étendu');
    }
}
new ViewInfirmerie().register();