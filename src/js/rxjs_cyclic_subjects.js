// This work-around works as follows :
// - A new function `circularize :: Rx.Subject -> circularSubjectS`
//   - That function is passed a subject and decorates it with additional termination functionality
//   - The `circularSubjectS` is still a `Rx.Subject` and can be used as usual
//   - The semantics of that `circularSubjectS` subject are the following :
//     - The subject holds a list and count of the subscriptions its observer side is subscribed to
//     - The observable side of the subject is combined with operators to give another observable. When that derived
//       observable completes, the subscription count on the `circularSubjectS` is decreased : there will be no new
//       values coming from that subscription. However there might be values still coming from other subscriptions
//       to that same proxy subject.
//       When the subscription count reaches 0 (no more dataflow possible), all subscriptions are disposed.
//     - Disposing of the associated subscription also terminates the associated subject (observer and observable sides)
//
// Tests :
// - Behaviour with normal termination
//   Cf. http://jsfiddle.net/4vzr7rfh/
// - Behaviour when termination is caused by error
//   Cf.
// - Behaviour with direct disposal of subscriptions
// - Behaviour with both direct subscription disposal and observable termination

var originalSubscribe = Rx.Observable.prototype.subscribe;

Rx.Observable.prototype.subscribe = function modifiedSubscribe(observer) {
  if (observer.__type === 'cyclicSubject') {
    var source = this;
    var disposables = observer.__disposables = observer.__disposables || new Rx.CompositeDisposable();
    var subscription = originalSubscribe.bind(source)(observer);
    disposables.add(subscription);
    observer.__subscriptionCount = disposables.length;
    return subscription;
  } else {
    return originalSubscribe.bind(this)(observer);
  }
};

function circularize(stdSubjectS) {
  var circularSubjectS;
  var observable = stdSubjectS
      .catch(function(e){
        console.log('error', e);
        return Rx.Observable.empty();
      })
      .finally(function () {
    if (typeof circularSubjectS.__subscriptionCount === 'undefined') {
      throw "Please check the `subscribe` overload for circular subjects is in place!"
    }

    console.log('Either subscription was disposed, or an error occurred, or the observable completed');

    circularSubjectS.__subscriptionCount -= 1;
    console.log('__subscriptionCount ', circularSubjectS.__subscriptionCount);

    (circularSubjectS.__subscriptionCount === 0 )
    && circularSubjectS.__disposables.dispose()
    && stdSubjectS.dispose();
  });

  circularSubjectS = Rx.Subject.create(stdSubjectS, observable);
  circularSubjectS.__subscription = undefined;
  circularSubjectS.__type = 'cyclicSubject'; // because instanceof will not work
  return circularSubjectS;
}

// Apply `circularize` to any type of subject to decorate it with the extra termination behaviour
var proxySubject = circularize(new Rx.Subject());

var subscription1 = proxySubject
    .take(6)
    .subscribe(onNext(1), onError(1), onCompleted);

var subscription2 = proxySubject
    .take(10)
    .subscribe(onNext(2), onError(2), onCompleted);

var subscription3 = proxySubject
    .take(15)
    .subscribe(onNext(3), onError(3), onCompleted);

// Two independent sources...
var timerSource = Rx.Observable.timer(0, 1000)
    .do(function (x) {
      console.log('timer', x)
    });
var letterSource = Rx.Observable.from(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'])
    .delay(1000)
    .map(function(){throw new Error('err')}) //  to comment in and out
    .do(function (x) {
      console.log('letter', x);
    });

// ... subscribed to the same proxy subject
proxySubscription = timerSource.subscribe(proxySubject);
proxySubscription2 = letterSource.subscribe(proxySubject);

// Helper functions
function onNext(x) {
  return function(y){
    console.log('subscription '+x+' onNext:', y);
  }
}

function onError(x) {
  return function(y) {
    console.log('subscription '+x+' onError:', y);
  }
}

function onCompleted() {
  console.log('onCompleted:')
}

// Uncomment this, to test behaviour under subscription disposal
//setTimeout(function () {
//  subscription2.dispose()
//}, 8000);

s = new Rx.Subject();
subscription = s.startWith('VALUE').do(console.log.bind(console)).subscribe(s);
// 1. when we dispose the subscription, the subject is still active (stopped = false) and can be used normally
//    We might want semantics of s.onCompleted() and s.dispose() to clean up
// 2. When we complete the subject, the subscription is stopped, the observer side of the subject is stopped
//    But the subject is not disposed and is still referenced in the subscription
//    subscription.dispose does not seem to do anything
//    s.dispose disposes the subject, but it remains referenced in the subscription
// The only difference between s.onCompleted() and subscription.dispose is that the subject is stopped in the first case
