/*jshint browser: true */
/*jshint unused: false */
/*global arangoHelper, Backbone, templateEngine, $, window, _, nv, d3 */
(function () {
  "use strict";

  window.ShardsView = Backbone.View.extend({

    el: '#content',
    template: templateEngine.createTemplate("shardsView.ejs"),
    interval: 10000,
    knownServers: [],

    events: {
      "click #shardsContent .pure-table-row" : "moveShard",
      "click #rebalanceShards"               : "rebalanceShards"
    },

    initialize: function (options) {
      var self = this;

      self.dbServers = options.dbServers;
      clearInterval(this.intervalFunction);

      if (window.App.isCluster) {
        this.updateServerTime();

        //start polling with interval
        this.intervalFunction = window.setInterval(function() {
          if (window.location.hash === '#shards') {
            self.render(false);
          }
        }, this.interval);
      }
    },

    render: function (navi) {

      var self = this;

      $.ajax({
        type: "GET",
        cache: false,
        url: arangoHelper.databaseUrl("/_admin/cluster/shardDistribution"),
        contentType: "application/json",
        processData: false,
        async: true,
        success: function(data) {
          self.continueRender(data);
        },
        error: function() {
          arangoHelper.arangoError("Cluster", "Could not fetch sharding information.");
        }
      });

      if (navi !== false) {
        arangoHelper.buildNodesSubNav('Shards');
      }
    },

    moveShard: function(e) {
      var dbName = window.App.currentDB.get("name");
      var collectionName = $(e.currentTarget).attr("collection");
      var shardName = $(e.currentTarget).attr("shard");
      var fromServer = $(e.currentTarget).attr("leader");

      var buttons = [],
        tableContent = [];

      var array = [];
      this.dbServers[0].each(function(db) {
        if (db.get("name") !== fromServer) {
          array.push({
            value: db.get("name"),
            label: db.get("name")
          });
        }
      });
      array = array.reverse();

      tableContent.push(
        window.modalView.createSelectEntry(
          "toDBServer",
          "Destination",
          undefined,
          //this.users !== null ? this.users.whoAmI() : 'root',
          "Please select the target databse server. The selected database " + 
          "server will be the new leader of the shard.",
            array
        )
      );

      buttons.push(
        window.modalView.createSuccessButton(
          "Move",
          this.confirmMoveShards.bind(this, dbName, collectionName, shardName, fromServer)
        )
      );

      window.modalView.show(
        "modalTable.ejs",
        "Move shard: " + shardName,
        buttons,
        tableContent
      );

    },

    confirmMoveShards: function(dbName, collectionName, shardName, fromServer) {
      var self = this;
      var toServer = $('#toDBServer').val();

      var data = {
        database: dbName,
        collection: collectionName,
        shard: shardName,
        fromServer: fromServer,
        toServer: toServer
      };

      $.ajax({
        type: "POST",
        cache: false,
        url: arangoHelper.databaseUrl("/_admin/cluster/moveShard"),
        contentType: "application/json",
        processData: false,
        data: JSON.stringify(data),
        async: true,
        success: function(data) {
          if (data === true) {
            window.setTimeout(function() {
              self.render(false);
            }, 1500);
            arangoHelper.arangoNotification("Shard " + shardName + " will be moved to " + toServer + ".");
          }
        },
        error: function() {
          arangoHelper.arangoNotification("Shard " + shardName + " could not be moved to " + toServer + ".");
        }
      });

      window.modalView.hide();
    },

    rebalanceShards: function() {
      var self = this;

      $.ajax({
        type: "POST",
        cache: false,
        url: arangoHelper.databaseUrl("/_admin/cluster/rebalanceShards"),
        contentType: "application/json",
        processData: false,
        data: JSON.stringify({}),
        async: true,
        success: function(data) {
          if (data === true) {
            window.setTimeout(function() {
              self.render(false);
            }, 1500);
            arangoHelper.arangoNotification("Started rebalance process.");
          }
        },
        error: function() {
          arangoHelper.arangoNotification("Could not start rebalance process.");
        }
      });

      window.modalView.hide();
    },

    continueRender: function(collections) {
      delete collections.code;
      delete collections.error;

      this.$el.html(this.template.render({
        collections: collections
      }));
    },

    updateServerTime: function() {
      this.serverTime = new Date().getTime();
    }

  });
}());