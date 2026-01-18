/**
 * Handler pour la vue officine
 * @extends {AppManagers.ViewHandler}
 */
class ViewOfficine extends AppManagers.ViewHandler {
    constructor() {
        super('viewOfficine');
    }
    async onload() {
        AppManagers.log('viewOfficine','info', 'onload étendu');
    }
}
new ViewOfficine().register();
