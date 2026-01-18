/**
 * Handler pour la vue Atelier
 * @extends AppManagers.ViewHandler
 */
class ViewAtelier extends AppManagers.ViewHandler {
    constructor() {
        super('viewAtelier');
    }
    async onload() {
        AppManagers.log('viewAtelier', 'info', 'onload étendu');
    }
}
new ViewAtelier().register();