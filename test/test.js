var router = new (require('biggie-router')),
    orm    = require('../../biggie-orm'),
    sync   = require('../');

var User = orm.model('User', {
  name: {type: 'string'},

  viewCallback: function () {
    var views = [];
    if (this.name === 'Tim') views.push('cool');
    return views;
  },
  views: ['cool'],
  indexes: ['name']
});

router.listen(8080);

sync.sync(orm, router);
