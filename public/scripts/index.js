'use strict';
var viewModel = (function() {
    function FilterData(name, displayName, url, activeDefault) {
        this.name = name;
        this.displayName = displayName;
        this.url = url;
        this.isActive = ko.observable(activeDefault);
        this.storageKey = name + '_active';

        this.loadSettings = function() {
            if (Modernizr.localstorage) {
                var isActive = localStorage[this.storageKey];
                if (isActive === undefined) {
                    isActive = activeDefault;
                    localStorage[this.storageKey] = isActive;
                } else {
                    isActive = isActive === 'true';
                }
                this.isActive(isActive);
            }
        };

        this.setActive = function(isActive) {
            this.isActive(isActive);
            if (Modernizr.localstorage) {
                localStorage[this.storageKey] = isActive;
            }
        };

        this.isNeutralOrCommon = function() {
            return this.name === 'neutral' || this.name === 'common';
        };
    }

    var _classDatas = [
        new FilterData('neutral', 'Neutral', '', false),
        new FilterData('druid', 'Malfurion',
            'http://media-hearth.cursecdn.com/avatars/80/382/621.png', false),
        new FilterData('hunter', 'Rexxar',
            'http://media-hearth.cursecdn.com/avatars/80/381/484.png', false),
        new FilterData('mage', 'Jaina',
            'http://media-hearth.cursecdn.com/avatars/80/384/320.png', false),
        new FilterData('paladin', 'Uther',
            'http://media-hearth.cursecdn.com/avatars/80/380/257.png', false),
        new FilterData('priest', 'Anduin',
            'http://media-hearth.cursecdn.com/avatars/80/385/110.png', false),
        new FilterData('rogue', 'Valeera',
            'http://media-hearth.cursecdn.com/avatars/80/380/257.png', false),
        new FilterData('shaman', 'Thrall',
            'http://media-hearth.cursecdn.com/avatars/80/378/319.png', false),
        new FilterData('warlock', 'Gul\'dan',
            'http://media-hearth.cursecdn.com/avatars/80/383/618.png', false),
        new FilterData('warrior', 'Garrosh',
            'http://media-hearth.cursecdn.com/avatars/80/377/635.png', false)
    ];

    var _totalPicksKey = 'totalpicks';
    var _totalWinsKey = 'totalwins';
    var _avgPickTimeKey = 'averagepicktime';
    var _cardHistory = [];
    var _maxCardHistory = 20;
    var _currentMatchupClass = '';
    var _matchupStartTime;
    var _summaryCountdown = 4 + Math.floor(Math.random() * 3);

    var _heroData = ko.observable('');
    var _totalPicks = ko.observable(0);
    var _totalWins = ko.observable(0);
    var _matchupText = ko.observable('');
    var _matchupSubtext = ko.observable('');
    var _cardOneData = ko.observable({});
    var _cardTwoData = ko.observable({});
    var _avgPickTime = ko.observable(0);
    var _showSummary = ko.observable(false);
    var _hideCards = ko.observable(false);

    var userRank = ko.computed(function() {
        var localScore = _totalPicks();
        var localRank;
        
        if (localScore < 10) {
            localRank = 'Basic';
        } else if (localScore >= 10 && localScore < 100) {
            localRank = 'Common';
        } else if (localScore >= 100 && localScore < 1000) {
            localRank = 'Rare';
        } else if (localScore >= 1000 && localScore < 10000) {
            localRank = 'Epic';
        } else if (localScore >= 10000) {
            localRank = 'Legendary';
        }
        return localRank;
    });

    var initialize = function() {
        loadSettings();
        showHeroImage();
        newMatchup();
    };

    var loadSettings = function() {
        if (Modernizr.localstorage) {
            var avgPickTime = parseInt(localStorage[_avgPickTimeKey], 10);
            if (!isNaN(avgPickTime)) {
                _avgPickTime(avgPickTime);
            }

            var totalPicks = parseInt(localStorage[_totalPicksKey], 10);
            if (!isNaN(totalPicks)) {
                _totalPicks(totalPicks);
            }

            var totalWins = parseInt(localStorage[_totalWinsKey], 10);
            if (!isNaN(totalWins)) {
                _totalWins(totalWins);
            }

            // class filter button are off by default
            _.forEach(_classDatas, function(classData) {
                classData.loadSettings();
            });

            // make sure that one class filter button is active
            if (_.all(_classDatas, function(classData) {
                return !classData.isActive();
            })) {
                var first = _.find(_classDatas);
                if (first) {
                    first.setActive(true);
                }
            }
        }
    };

    var showHeroImage = function() {
        var heroData = _.find(_classDatas, function(classData) {
            return classData.isActive() && !classData.isNeutralOrCommon();
        });

        if (heroData) {
            _heroData(heroData);
        }
        else {
            _heroData('');
        }
    };

    var filterButtonClick = function(filterData) {
        // process clicks from class filter buttons
        // make sure only one hero is on at a time
        var clickedClassData = _.find(_classDatas, function(classData) {
            return classData.name === filterData.name;
        });

        if (clickedClassData) {
            if (!clickedClassData.isNeutralOrCommon()) {
                _.chain(_classDatas)
                    .filter(function(classData) {
                        return !classData.isNeutralOrCommon() &&
                            classData.name !== clickedClassData.name && classData.isActive();
                    })
                    .forEach(function(classData) {
                        classData.setActive(false);
                    });
            }

            clickedClassData.setActive(!clickedClassData.isActive());

            if (_.all(_classDatas, function(classData) { return !classData.isActive(); })) {
                clickedClassData.setActive(true);
            }
        }

        showHeroImage();
        clearMatchup();
        newMatchup();
    };

    var cardOneClick = function() {
        processMatchup(_cardOneData(), _cardTwoData());
        checkForSummary();
    };
    
    var cardTwoClick = function() {
        processMatchup(_cardTwoData(), _cardOneData());
        checkForSummary();
    };

    var summaryClick = function() {
        newMatchup();
    };

    var checkForSummary = function() {
        _summaryCountdown = _summaryCountdown - 1;
        if (_summaryCountdown === 0) {
            _summaryCountdown = 8 + Math.floor(Math.random() * 5);
            _hideCards(true);
            _showSummary(true);
            _matchupText('');
        } else {
            setTimeout(function() {
                newMatchup();
            }, 1000);
        }
    };

    var updateSummaryInfo = function(pickedBest, decisionTime) {
        var picks = _totalPicks();
        _totalPicks(picks + 1);

        var wins = _totalWins();
        if (pickedBest) {
            _totalWins(wins + 1);
        }

        var avgPickTime = _avgPickTime();
        if (avgPickTime === 0) {
            _avgPickTime(decisionTime);
        } else {
            _avgPickTime((avgPickTime + decisionTime) / 2);
        }

        if (Modernizr.localstorage) {
            localStorage[_totalPicksKey] = _totalPicks();
            localStorage[_totalWinsKey] = _totalWins();
            localStorage[_avgPickTimeKey] = _avgPickTime();
        }
    };

    var setImageUrl = function(card, size) {
        card.url = card.url.replace('\/medium\/', '\/' + size + '\/');
    };

    var setMatchupText = function(cardOne, cardTwo) {
        var rankOne = cardOne.currentRank;
        var rankTwo = cardTwo.currentRank;
        var rankDiff = Math.abs(rankOne - rankTwo);

        if (rankDiff < 260) {
            _matchupSubtext('(careful, this one\'s tricky)');
        } else if (rankDiff < 1300) {
            _matchupSubtext('(hmm...)');
        } else {
            _matchupSubtext('(piece of cake)');
        }

        _matchupText('');
    };

    var clearMatchup = function() {
        _hideCards(true);
        _matchupSubtext('');
    };

    var newMatchup = function() {
        var classes = _.chain(_classDatas)
            .filter(function(classData) {
                return classData.isActive();
            })
            .map(function(classData) {
                return classData.name;
            })
            .value();

        _cardOneData({ url: ''});
        _cardTwoData({ url: ''});

        var sendData = {
            cardHistory: _cardHistory,
            classes: classes
        };

        $.post('/api/newmatchup/', sendData, function(data) {
            setMatchupText(data.cardOne, data.cardTwo);
            setImageUrl(data.cardOne, 'original');
            setImageUrl(data.cardTwo, 'original');
            _cardOneData(data.cardOne);
            _cardTwoData(data.cardTwo);
            _currentMatchupClass = data.class;
            _matchupStartTime = new Date().getTime();
            _hideCards(false);
            _showSummary(false);
        });
    };

    var processMatchup = function(pickedCard, unpickedCard) {
        var matchupStopTime = new Date().getTime();
        var decisionTime = matchupStopTime - _matchupStartTime;
        var pickedRank = pickedCard.currentRank;
        var unpickedRank = unpickedCard.currentRank;
        var pickedBest = pickedRank >= unpickedRank;

        if (_cardHistory.length === _maxCardHistory) {
            _cardHistory.length = _maxCardHistory - 2;
        }

        _cardHistory.unshift(pickedCard.id);
        _cardHistory.unshift(unpickedCard.id);

        _matchupText(pickedBest ? 'The crowd agrees' : 'The crowd does not agree');
        updateSummaryInfo(pickedBest, decisionTime);
        clearMatchup();

        var sendData = {
            cardWinnerId: pickedCard.id,
            cardLoserId: unpickedCard.id,
            cardWinnerRank: pickedCard.currentRank,
            cardLoserRank: unpickedCard.currentRank,
            milliseconds: decisionTime,
            class: _currentMatchupClass
        };

        $.post('/api/savematchup/', sendData, function() {
        });
    };

    return {
        initialize: initialize,
        filterButtonClick: filterButtonClick,
        summaryClick: summaryClick,
        cardOneClick: cardOneClick,
        cardTwoClick: cardTwoClick,
        cardOneData: _cardOneData,
        cardTwoData: _cardTwoData,
        matchupText: _matchupText,
        matchupSubtext: _matchupSubtext,
        totalPicks: _totalPicks,
        totalWins: _totalWins,
        rank: userRank,
        classes: _classDatas,
        heroData: _heroData,
        averagePickTime: _avgPickTime,
        showSummary: _showSummary,
        hideCards: _hideCards
    };
}());

$(document).ready(function() {
    //    localStorage.clear();
    viewModel.initialize();
    ko.applyBindings(viewModel);
});
