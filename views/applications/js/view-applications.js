/**
 * Handler pour la vue applications
 * @extends {AppManagers.ViewHandler}
 */
class ViewApplications extends AppManagers.ViewHandler {
    constructor() {
        super('viewApplications');
    }
    async onload() {
        AppManagers.log('viewApplications', 'info', 'onload étendu');
    }
}
new ViewApplications().register();