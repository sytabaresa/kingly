/**
 * Created by bcouriol on 21/02/16.
 */
var state_definition = {
    screen_xyz: {
        changes_state_group: {
            changes_need_saving: 'blabla',
            no_changes_made: 'dsa'
        },
        changes_in_progress: 'ss'
    }
};
var events = create_event_enum('edit', 'delete');
var transitions = [
    {from: states.NOK, to: states.changes_state_group, event: events.INIT, action: fsm_initialize_model},
    {from: states.no_changes_made, to: states.changes_need_saving, event: events.DELETE,
        condition: function (model, event_data) {
            return true
        }, actions: log},
    {from: states.changes_state_group, to: states.changes_in_progress, event: events.EDIT, action: log},
];
