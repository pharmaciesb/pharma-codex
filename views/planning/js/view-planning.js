/**
 * Handler pour la vue planning
 * @extends {AppManagers.ViewHandler}
 */
class ViewPlanning extends AppManagers.ViewHandler {
    constructor() {
        super('viewPlanning');
    }
    async onload() {
        AppManagers.log('viewPlanning','info', 'onload étendu');
    }
}
new ViewPlanning().register();