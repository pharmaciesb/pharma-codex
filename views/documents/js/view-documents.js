/**
 * Handler pour la vue Documents
 * @extends AppManagers.ViewHandler
 */
class ViewDocuments extends AppManagers.ViewHandler {
    constructor() {
        super('viewDocuments');
    }
    async onload() {
        AppManagers.log('viewDocuments', 'info', 'onload étendu');
    }
}
new ViewDocuments().register();