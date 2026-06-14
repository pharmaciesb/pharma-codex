/**
 * Handler pour la vue orthopedie
 * @extends {AppManagers.ViewHandler}
 */
class ViewOrthopedie extends AppManagers.ViewHandler {
    constructor() {
        super('viewOrthopedie');
    }
    async onload() {
        AppManagers.log('viewOrthopedie','info', 'onload étendu');
    }
}
new ViewOrthopedie().register();