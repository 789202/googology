var lineBreakRegex=/\r?\n/g;
var itemSeparatorRegex=/[\t ]/g;
window.onload=function (){
  console.clear();
  dg('input').onkeydown=handlekey;
  dg('input').onfocus=handlekey;
  dg('input').onmousedown=handlekey;
}
function dg(s){
  return document.getElementById(s);
}

function normalizeAbbreviations(s){
  return new Term(s+"")+"";
}
function abbreviate(s){
  return new Term(s+"").toString(true);
}

function Scanner(s){
  if (s instanceof Scanner) return s.clone();
  if (typeof s!="string") throw Error("Invalid expression: "+s);
  if (!(this instanceof Scanner)) return new Scanner(s);
  this.s=s;
  this.pos=0;
  this.length=s.length;
  return this;
}
Scanner.prototype.clone=function (){
  return new Scanner(this.s);
}
Scanner.prototype.next=function (){
  if (this.pos>=this.length) return null;
  var c=this.s.charAt(this.pos);
  ++this.pos;
  return c;
}
Scanner.prototype.nextNumber=function (){
  var s=this.s.substring(this.pos);
  var m=s.match(/^[0-9]+/);
  if (m) {
    this.pos+=m[0].length;
    return Number(m[0]);
  }
  return null;
}
Scanner.prototype.peek=function (length,offset){
  if (typeof length=="undefined") length=1;
  if (typeof offset=="undefined") offset=0;
  if (this.pos+offset>this.length) return null;
  return this.s.substring(this.pos+offset,this.pos+offset+length);
}
Scanner.prototype.move=function (n){
  this.pos+=n;
}
Scanner.prototype.hasNext=function (){
  return this.pos<this.length;
}
Scanner.prototype.finished=function (){
  return this.pos>=this.length;
}
Object.defineProperty(Scanner.prototype,"constructor",{
  value:Scanner,
  enumerable:false,
  writable:true
});

/**
 * @constructor
 * @param {*} s 
 * @returns {Term}
 */
 function Term(s){
  if (s instanceof Term) return s.clone();
  else if (typeof s!="undefined"&&typeof s!="string") throw Error("Invalid expression: "+s);
  if (!(this instanceof Term)) return new Term(s);
  if (s) return Term.build(s);
  else return this;
}
/**
 * @param {Term|string|Scanner} s 
 * @param {number=} context 
 * @returns {Term}
 */
Term.build=function (s,context){
  if (s instanceof Term) return s.clone();
  function appendToRSum(term){
    if (state==START) r=term;
    else if (state==PLUS) r=SumTerm.buildNoClone([r,term]);
    else throw Error("Wrong state when attempting to append as sum");
    state=CLOSEDTERM;
  }
  var nums="0123456789";
  var scanner;
  if (typeof s=="string") scanner=new Scanner(s);
  else if (s instanceof Scanner) scanner=s;
  else throw Error("Invalid expression: "+s);
  /** @type {Term} */
  var r=null;
  var startpos=scanner.pos;
  var TOP=0;
  var PSITERMSUBSCRIPT=1;
  var PSITERMINNER=2;
  var BRACES=3;
  var contextNames=["TOP","PSITERMSUBSCRIPT","PSITERMINNER","BRACES"];
  if (typeof context=="undefined") context=TOP;
  var START=0;
  var PLUS=1;
  var CLOSEDTERM=2;
  var EXIT=3;
  var stateNames=["START","PLUS","CLOSEDTERM","EXIT"];
  var state=START;
  while (scanner.hasNext()&&state!=EXIT){
    var scanpos=scanner.pos;
    var next=scanner.next();
    if (nums.indexOf(next)!=-1){
      if (state!=START&&state!=PLUS) throw Error("Unexpected character "+next+" at position "+scanpos+" in expression "+scanner.s);
      scanner.move(-1);
      var num=scanner.nextNumber();
      if (num==0){
        appendToRSum(ZeroTerm.build());
      }else if (num==1){
        appendToRSum(Term.ONE.clone());
      }else{
        var decomposed;
        if (state==START) decomposed=[];
        else if (state==PLUS) decomposed=[r];
        for (var i=0;i<num;i++){
          decomposed.push(Term.ONE.clone());
        }
        r=SumTerm.buildNoClone(decomposed);
        state=CLOSEDTERM;
      }
    }else if (next=="ω"||next=="w"){
      if (state!=START&&state!=PLUS) throw Error("Unexpected character "+next+" at position "+scanpos+" in expression "+scanner.s);
      appendToRSum(Term.SMALLOMEGA.clone());
    }else if (next=="+"){
      if (state==CLOSEDTERM){
        state=PLUS;
      }else throw Error("Unexpected character + at position "+scanpos+" in expression "+scanner.s);
    }else if (next=="ψ"||next=="p"||next=="("){
      if (state!=START&&state!=PLUS) throw Error("Unexpected character "+next+" at position "+scanpos+" in expression "+scanner.s);
      var subterms=[];
      if (next=="ψ"||next=="p"){
        var nextnext=scanner.next();
        if (nextnext!="_"&&nextnext!="(") throw Error("Expected _ or ( at position "+(scanner.pos-1)+", instead got "+nextnext+" in expression "+scanner.s);
        if (nextnext=="_"){
          subterms.push(Term.build(scanner,PSITERMSUBSCRIPT));
          var nextnext=scanner.next();
          if (nextnext!="(") throw Error("Expected opening ( at position "+(scanner.pos-1)+", instead got "+nextnext+" in expression "+scanner.s);
        }
      }
      while (subterms.length<3){
        subterms.push(Term.build(scanner,PSITERMINNER));
        var nextnext=scanner.next();
        if (nextnext==","){
          if (subterms.length>=3) throw Error("Too many terms in ψ term at position "+scanpos+" in expression "+scanner.s);
        }else if (nextnext==")") break;
        else throw Error("Expected a comma or closing ) at position "+(scanner.pos-1)+", instead got "+nextnext+" in expression "+scanner.s);
      }
      while (subterms.length<3) subterms.unshift(ZeroTerm.build());
      appendToRSum(PsiTerm.buildNoClone.apply(null,subterms));
    }else if (next=="{"){
      if (state!=START&&state!=PLUS) throw Error("Unexpected character { at position "+scanpos+" in expression "+scanner.s);
      var subterm=Term.build(scanner,BRACES);
      var nextnext=scanner.next();
      if (nextnext!="}") throw Error("Expected closing } at position "+(scanner.pos-1)+", instead got "+nextnext+" in expression "+scanner.s);
      appendToRSum(subterm);
    }else{
      throw Error("Unexpected character "+next+" at position "+scanpos+" in expression "+scanner.s);
    }
    if (state==CLOSEDTERM){
      var peek=scanner.peek();
      if (context==BRACES&&peek=="}"){
        state=EXIT;
      }else if (context==PSITERMSUBSCRIPT&&peek=="("){
        state=EXIT;
      }else if (context==PSITERMINNER&&(peek==","||peek==")")){
        state=EXIT;
      }
    }
  }
  if (context==TOP){
    if (scanner.hasNext()) throw Error("Something went wrong");
    if (state==START) r=ZeroTerm.build();
    else if (state==PLUS) throw Error("Unexpected end of input");
    else if (state==CLOSEDTERM);
  }else{
    if (!scanner.hasNext()) throw Error("Unexpected end of input");
    if (state==START) r=ZeroTerm.build();
    else if (state==PLUS) throw Error("Something went wrong");
    else if (state==CLOSEDTERM);
  }
  return r;
}
/** @returns {Term} */
Term.buildNoClone=function (){
  throw Error("Not implemented");
}
/** @returns {Term} */
Term.prototype.clone=function (){
  throw Error("Cloning undefined for this term type.");
}
/**
 * @param {Term} x 
 * @returns {Term}
 */
Term.clone=function (x){
  return x.clone();
}
/**
 * @param {boolean} abbreviate
 * @returns {string}
 */
Term.prototype.toString=function (abbreviate){
  throw Error("Stringification undefined for this term type.");
}
/**
 * @param {boolean} abbreviate 
 * @returns {string}
 */
Term.prototype.toStringWithImplicitBrace=function (abbreviate){
  return this.toString(abbreviate);
}
/** @returns {boolean} */
Term.prototype.equal=function (other){
  throw Error("Equality undefined for this term type.");
}
/**
 * @returns {boolean}
 */
Term.equal=function (x,y){
  if (!(x instanceof Term)) x=new Term(x);
  return x.equal(y);
}
Object.defineProperty(Term.prototype,"constructor",{
  value:Term,
  enumerable:false,
  writable:true
});

/**
 * @extends {Term}
 * @constructor
 * @param {*} s 
 * @returns {NullTerm}
 */
function NullTerm(s){
  if (s instanceof NullTerm) return s.clone();
  else if (typeof s!="undefined"&&s!==null) throw Error("Invalid expression: "+s);
  if (!(this instanceof NullTerm)) return new NullTerm(s);
  Term.call(this,s);
  if (s&&!(this instanceof NullTerm)) throw Error("Invalid expression: "+s);
}
Object.assign(NullTerm,Term);
NullTerm.build=function (){
  var r=new NullTerm();
  return r;
}
NullTerm.buildNoClone=function (){
  var r=new NullTerm();
  return r;
}
NullTerm.prototype=Object.create(Term.prototype);
NullTerm.prototype.clone=function (){
  return NullTerm.build();
}
/** @param {boolean} abbreviate */
NullTerm.prototype.toString=function (abbreviate){
  return "";
}
NullTerm.prototype.equal=function (other){
  if (!(other instanceof Term)) other=new Term(other);
  return other instanceof NullTerm;
}
Object.defineProperty(NullTerm.prototype,"constructor",{
  value:NullTerm,
  enumerable:false,
  writable:true
});

/**
 * @extends {Term}
 * @constructor
 * @param {*} s 
 * @returns {ZeroTerm}
 */
function ZeroTerm(s){
  if (s instanceof ZeroTerm) return s.clone();
  else if (s instanceof Term&&typeof s!="string") throw Error("Invalid expression: "+s);
  if (!(this instanceof ZeroTerm)) return new ZeroTerm(s);
  Term.call(this,s);
  if (s&&!(this instanceof ZeroTerm)) throw Error("Invalid expression: "+s);
}
Object.assign(ZeroTerm,Term);
ZeroTerm.build=function (){
  var r=new ZeroTerm();
  return r;
}
ZeroTerm.buildNoClone=function (){
  var r=new ZeroTerm();
  return r;
}
ZeroTerm.prototype=Object.create(Term.prototype);
ZeroTerm.prototype.clone=function (){
  return ZeroTerm.build();
}
/** @param {boolean} abbreviate */
ZeroTerm.prototype.toString=function (abbreviate){
  return "0";
}
ZeroTerm.prototype.equal=function (other){
  if (!(other instanceof Term)) other=new Term(other);
  return other instanceof ZeroTerm;
}
Object.defineProperty(ZeroTerm.prototype,"constructor",{
  value:ZeroTerm,
  enumerable:false,
  writable:true
});

/**
 * @extends {Term}
 * @constructor
 * @param {*} s 
 * @returns {PsiTerm}
 */
function PsiTerm(s){
  if (s instanceof PsiTerm) return s.clone();
  else if (s instanceof Term&&typeof s!="string") throw Error("Invalid expression: "+s);
  if (!(this instanceof PsiTerm)) return new PsiTerm(s);
  /** @type {PsiTerm} */
  Term.call(this,s);
  if (s&&!(this instanceof PsiTerm)) throw Error("Invalid expression: "+s);
  /** @type {Term} */
  this.sub=null;
  /** @type {Term} */
  this.inner1=null;
  /** @type {Term} */
  this.inner2=null;
}
Object.assign(PsiTerm,Term);
PsiTerm.build=function (sub,inner1,inner2){
  var r=new PsiTerm();
  r.sub=new Term(sub);
  r.inner1=new Term(inner1);
  r.inner2=new Term(inner2);
  return r;
}
/**
 * 
 * @param {Term} sub 
 * @param {Term} inner1 
 * @param {Term} inner2 
 * @returns {PsiTerm}
 */
PsiTerm.buildNoClone=function (sub,inner1,inner2){
  var r=new PsiTerm();
  r.sub=sub;
  r.inner1=inner1;
  r.inner2=inner2;
  return r;
}
PsiTerm.prototype=Object.create(Term.prototype);
PsiTerm.prototype.clone=function (){
  return PsiTerm.build(this.sub,this.inner1,this.inner2);
}
/** @param {boolean} abbreviate */
PsiTerm.prototype.toString=function (abbreviate){
  if (abbreviate&&this.equal(Term.ONE)) return "1";
  else if (abbreviate&&this.equal(Term.SMALLOMEGA)) return "ω";
  else if (abbreviate&&this.sub.equal(Term.ZERO)){
    if (this.inner1.equal(Term.ZERO)) return "ψ("+this.inner2.toString(abbreviate)+")";
    else return "ψ("+this.inner1.toString(abbreviate)+","+this.inner2.toString(abbreviate)+")";
  }else return "ψ_"+this.sub.toStringWithImplicitBrace(abbreviate)+"("+this.inner1.toString(abbreviate)+","+this.inner2.toString(abbreviate)+")";
}
PsiTerm.prototype.equal=function (other){
  if (!(other instanceof Term)) other=new Term(other);
  return other instanceof PsiTerm&&this.sub.equal(other.sub)&&this.inner1.equal(other.inner1)&&this.inner2.equal(other.inner2);
}
Object.defineProperty(PsiTerm.prototype,"constructor",{
  value:PsiTerm,
  enumerable:false,
  writable:true
});

/**
 * @extends {Term}
 * @constructor
 * @param {*} s 
 * @returns {SumTerm}
 */
function SumTerm(s){
  if (s instanceof SumTerm) return s.clone();
  else if (s instanceof Term&&typeof s!="string") throw Error("Invalid expression: "+s);
  if (!(this instanceof SumTerm)) return new SumTerm(s);
  Term.call(this,s);
  if (s&&!(this instanceof SumTerm)) throw Error("Invalid expression: "+s);
  /** @type {Term[]} */
  this.terms=null;
}
Object.assign(SumTerm,Term);
/** @param {*[]} terms */
SumTerm.build=function (terms){
  var r=new SumTerm();
  r.terms=[];
  for (var i=0;i<terms.length;i++){
    if (terms[i] instanceof SumTerm){
      r.terms=r.terms.concat(new Term(terms[i]).terms);
    }else{
      r.terms.push(new Term(terms[i]));
    }
  }
  return r;
}
/** @param {Term[]} terms */
SumTerm.buildNoClone=function (terms){
  var r=new SumTerm();
  r.terms=[];
  for (var i=0;i<terms.length;i++){
    if (terms[i] instanceof SumTerm){
      r.terms=r.terms.concat(terms[i].terms);
    }else{
      r.terms.push(terms[i]);
    }
  }
  return r;
}
SumTerm.prototype=Object.create(Term.prototype);
SumTerm.prototype.clone=function (){
  return SumTerm.build(this.terms);
}
/** @param {boolean} abbreviate */
SumTerm.prototype.toString=function (abbreviate){
  if (abbreviate){
    var strterms=this.terms.map(function (t){return t.toString(abbreviate);});
    for (var i=0;i<strterms.length;i++){
      if (strterms[i]=="1"){
        for (var j=i;j<strterms.length&&strterms[j]=="1";j++);
        strterms.splice(i,j-i,(j-i)+"");
      }
    }
    return strterms.join("+");
  }else{
    return this.terms.join("+");
  }
}
/** @param {boolean} abbreviate */
SumTerm.prototype.toStringWithImplicitBrace=function (abbreviate){
  if (abbreviate&&isNat(this)) return this.toString(abbreviate);
  else return "{"+this.toString(abbreviate)+"}";
}
SumTerm.prototype.equal=function (other){
  if (!(other instanceof Term)) other=new Term(other);
  return other instanceof SumTerm
    ?this.terms.length==other.terms.length&&this.terms.every(function (e,i){return e.equal(other.terms[i]);})
    :this.terms.length==1&&this.terms[0].equal(other);
}
SumTerm.prototype.getLeft=function (){
  return new Term(this.terms[0]);
}
SumTerm.prototype.getNotLeft=function (){
  if (this.terms.length<2) return ZeroTerm.build();
  else if (this.terms.length<=2) return new Term(this.terms[1]);
  else return SumTerm.build(this.terms.slice(1));
}
SumTerm.prototype.getRight=function (){
  return new Term(this.terms[this.terms.length-1]);
}
SumTerm.prototype.getNotRight=function (){
  if (this.terms.length<2) return ZeroTerm.build();
  else if (this.terms.length<=2) return new Term(this.terms[0]);
  else return SumTerm.build(this.terms.slice(0,-1));
}
/**
 * @param {number} start 
 * @param {number} end 
 */
SumTerm.prototype.slice=function (start,end){
  if (start<0) start=this.terms.length+start;
  if (end===undefined) end=this.terms.length;
  if (end<0) end=this.terms.length+end;
  if (start>=end) return NullTerm.build();
  else if (end-start==1) return new Term(this.terms[start]);
  else return SumTerm.build(this.terms.slice(start,end));
}
Object.defineProperty(SumTerm.prototype,"constructor",{
  value:SumTerm,
  enumerable:false,
  writable:true
});

Term.ZERO=new Term("0");
Term.ONE=new Term("ψ_0(0,0)");
Term.SMALLOMEGA=new Term("ψ_0(0,1)");

/** @returns {boolean} */
function inT(t){
  try{
    if (!(t instanceof Term)) t=new Term(t);
  }catch(e){
    return false;
  }
  if (t instanceof ZeroTerm) return true;
  if (t instanceof PsiTerm) return inT(t.sub)&&inT(t.inner1)&&inT(t.inner2);
  if (t instanceof SumTerm) return t.terms.every(function (t){return !t.equal("0")&&inPT(t);});
  return false;
}
function inPT(t){
  try{
    if (!(t instanceof Term)) t=new Term(t);
  }catch(e){
    return false;
  }
  if (t instanceof PsiTerm) return inT(t.sub)&&inT(t.inner1)&&inT(t.inner2);
  return false;
}
/**
 * @param {Term} t
 * @param {(value:Term,index:number,array:Term[])=>boolean} f
 */
function isSumAndTermsSatisfy(t,f){
  return t instanceof SumTerm&&t.terms.every(f);
}
function isNat(t){
  try{
    if (!(t instanceof Term)) t=new Term(t);
  }catch(e){
    return false;
  }
  return t instanceof Term&&(t.equal("1")||isSumAndTermsSatisfy(t,equal("1")));
}
function toNat(X){
  if (!(X instanceof Term)) X=new Term(X);
  if (!isNat(X)) throw Error("Invalid argument: "+X);
  if (X instanceof ZeroTerm) return 0;
  if (X instanceof PsiTerm) return 1;
  if (X instanceof SumTerm) return X.terms.length;
  throw Error("This should be unreachable");
}
/** @return {boolean|(t:any)=>boolean} */
function equal(X,Y){
  if (!(X instanceof Term)) X=new Term(X);
  if (arguments.length==1) return function(t){return equal(t,X);};
  if (!(Y instanceof Term)) Y=new Term(Y);
  return X.equal(Y);
}
function notEqual(X,Y){
  if (arguments.length==1) return function(t){return notEqual(t,X);};
  return !equal(X,Y);
}
/**
 * @param {Term|string} S 
 * @param {Term|string} T 
 * @returns {boolean}
 */
function lessThan(S,T){
  if (!(S instanceof Term)) S=new Term(S);
  if (!(T instanceof Term)) T=new Term(T);
  if (T instanceof ZeroTerm) return false; //1
  if (S instanceof ZeroTerm) return true; //2
  if (S instanceof SumTerm){ //3
    if (T instanceof SumTerm) //3.1
      return lessThan(S.getLeft(),T.getLeft()) //3.1.1
        ||equal(S.getLeft(),T.getLeft())&&lessThan(S.getNotLeft(),T.getNotLeft()); //3.1.2
    if (T instanceof PsiTerm) return lessThan(S.getLeft(),T); //3.2
  }
  if (S instanceof PsiTerm){ //4
    if (T instanceof SumTerm) return lessThanOrEqual(S,T.getLeft()) //4.1
    if (T instanceof PsiTerm) //4.2
      return lessThan(S.sub,T.sub) //4.2.1
        ||equal(S.sub,T.sub)&&(
          lessThan(S.inner1,T.inner1) //4.2.2
          ||equal(S.inner1,T.inner1)&&lessThan(S.inner2,T.inner2) //4.2.3
        );
  }
  throw Error("No rule to compare "+S+" and "+T);
}
/** @returns {boolean} */
function lessThanOrEqual(S,T){
  if (!(S instanceof Term)) S=new Term(S);
  if (!(T instanceof Term)) T=new Term(T);
  return equal(S,T)||lessThan(S,T);
}
/**
 * @param {Term|string} S
 * @returns {string}
 */
function dom(S){
  if (!(S instanceof Term)) S=new Term(S);
  if (!inT(S)) throw Error("Invalid argument: "+S);
  if (S instanceof ZeroTerm) return "0"; //1
  if (S instanceof SumTerm) return dom(S.getRight()); //2
  if (S instanceof PsiTerm){ //3
    var dom_S_inner2=dom(S.inner2);
    var Term_dom_S_inner2=new Term(dom_S_inner2);
    if (equal(Term_dom_S_inner2,"0")){ //3.1
      var dom_S_inner1=dom(S.inner1);
      var Term_dom_S_inner1=new Term(dom_S_inner1);
      if (equal(Term_dom_S_inner1,"0")){ //3.1.1
        var dom_S_sub=dom(S.sub);
        var Term_dom_S_sub=new Term(dom_S_sub);
        if (equal(Term_dom_S_sub,"0")||equal(Term_dom_S_sub,"1")) return S+""; //3.1.1.1
        else return dom_S_sub; //3.1.1.2
      }else if (equal(Term_dom_S_inner1,"1")) return S+""; //3.1.2
      else{ //3.1.3
        if (lessThan(Term_dom_S_inner1,S)) return dom_S_inner1; //3.1.3.1
        else return normalizeAbbreviations("ω"); //3.1.3.2
      }
    }else if (equal(Term_dom_S_inner2,"1")||equal(Term_dom_S_inner2,"ω")) return normalizeAbbreviations("ω"); //3.2
    else{ //3.3
      if (lessThan(Term_dom_S_inner2,S)) return dom_S_inner2; //3.3.1
      else return normalizeAbbreviations("ω"); //3.3.2
    }
  }
  throw Error("No rule to compute dom of "+S);
}
/**
 * @param {Term|string} S 
 * @param {Term|number|string} T 
 * @returns {string}
 */
function fund(S,T){
  if (!(S instanceof Term)) S=new Term(S);
  if (typeof T=="number") T=String(T);
  if (!(T instanceof Term)) T=new Term(T);
  if (!inT(S)||!inT(T)) throw Error("Invalid argument: "+S+","+T);
  if (S instanceof ZeroTerm) return "0"; //1
  if (S instanceof SumTerm){ //2
    var m=S.terms.length;
    if (S.terms[m-1] instanceof PsiTerm&&equal(dom(S.terms[m-1].inner2),"1")){ //2.1
      if (isNat(T)){ //2.1.1
        var i=toNat(T);
        var G,g;
        for (var k=m-1;k>=0;k--){ //2.1.1.1
          if (k>0&&S.terms[k-1] instanceof PsiTerm&&equal(S.terms[k-1].sub,S.terms[m-1].sub)&&equal(S.terms[k-1].inner1,S.terms[m-1].inner1)&&lessThan(S.terms[k-1].inner2,S.terms[m-1].inner2)){ //2.1.1.1.1
            G=(k<m-1?S.slice(k,m-1)+"+":"")+fund(S.terms[m-1],"1");
            g=S.slice(0,k-1)+"";
            break;
          }else if (k==0){ //2.1.1.1.2
            G=(0<m-1?S.slice(0,m-1)+"+":"")+fund(S.terms[m-1],"1");
            g=G;
          }
        }
        var Gj;
        for (var j=0;j<=i;j++){ //2.1.1.2
          if (j==0) Gj=G; //2.1.1.2.1
          else Gj=G+"+"+Gj; //2.1.1.2.2
        }
        return g+"+"+Gj;
      }else return (0<m-1?S.slice(0,m-1)+"+":"")+fund(S.terms[m-1],"1"); //2.1.2
    }else{ //2.2
      var Smp=fund(S.terms[m-1],T);
      if (equal(Smp,"0")) return S.getNotRight(); //2.2.1;2.2.2
      else return S.getNotRight()+"+"+Smp; //2.2.3
    }
  }
  if (S instanceof PsiTerm){ //3
    var Term_fund_S_fund_T_0=null;
    var dom_S_inner2=dom(S.inner2);
    var Term_dom_S_inner2=new Term(dom_S_inner2);
    if (equal(Term_dom_S_inner2,"0")){ //3.1
      var dom_S_inner1=dom(S.inner1);
      var Term_dom_S_inner1=new Term(dom_S_inner1);
      if (equal(Term_dom_S_inner1,"0")){ //3.1.1
        var dom_S_sub=dom(S.sub);
        var Term_dom_S_sub=new Term(dom_S_sub);
        if (equal(Term_dom_S_sub,"0")||equal(Term_dom_S_sub,"1")) return T+""; //3.1.1.1
        else return "ψ_"+fund(S.sub,T)+"("+S.inner1+","+S.inner2+")"; //3.1.1.2
      }else if (equal(Term_dom_S_inner1,"1")) return T+""; //3.1.2
      else{ //3.1.3
        if (lessThan(Term_dom_S_inner1,S)) return "ψ_"+S.sub+"("+fund(S.inner1,T)+","+S.inner2+")"; //3.1.3.1
        else{ //3.1.3.2
          if (!(Term_dom_S_inner1 instanceof PsiTerm)) throw Error("Unexpected error");
          var d=Term_dom_S_inner1.sub;
          var e=Term_dom_S_inner1.inner1;
          if (equal(e,"0")){ //3.1.3.2.1
            if (isNat(T)&&(Term_fund_S_fund_T_0=new Term(fund(S,fund(T,"0")))) instanceof PsiTerm&&equal(Term_fund_S_fund_T_0.sub,S.sub)&&equal(Term_fund_S_fund_T_0.inner2,S.inner2)) return "ψ_"+S.sub+"("+fund(S.inner1,"ψ_"+fund(d,"0")+"("+Term_fund_S_fund_T_0.inner1+",0)")+","+S.inner2+")"; //3.1.3.2.1.1
            else return "ψ_"+S.sub+"("+fund(S.inner1,"ψ_"+fund(d,"0")+"("+e+",0)")+","+S.inner2+")"; //3.1.3.2.1.2
          }else{ //3.1.3.2.2
            if (isNat(T)&&(Term_fund_S_fund_T_0=new Term(fund(S,fund(T,"0")))) instanceof PsiTerm&&equal(Term_fund_S_fund_T_0.sub,S.sub)&&equal(Term_fund_S_fund_T_0.inner2,S.inner2)) return "ψ_"+S.sub+"("+fund(S.inner1,"ψ_"+d+"("+fund(e,"0")+","+Term_fund_S_fund_T_0.inner1+")")+","+S.inner2+")"; //3.1.3.2.2.1
            else return "ψ_"+S.sub+"("+fund(S.inner1,"ψ_"+d+"("+fund(e,"0")+",0)")+","+S.inner2+")"; //3.1.3.2.2.2
          }
        }
      }
    }else if (equal(Term_dom_S_inner2,"1")){ //3.2
      var Term_fund_T_0=null;
      if (equal(T,"1")) return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,"0")+")"; //3.2.1
      else if (equal(T,(Term_fund_T_0=new Term(fund(T,"0")))+"+1")) return fund(S,Term_fund_T_0)+"+"+fund(S,"1"); //3.2.2
      else return "0"; //3.2.3
    }else if (equal(Term_dom_S_inner2,"ω")) return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,T)+")"; //3.3
    else{ //3.4
      if (lessThan(Term_dom_S_inner2,S)) return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,T)+")"; //3.4.1
      else{ //3.4.2
        if (!(Term_dom_S_inner2 instanceof PsiTerm)) throw Error("Unexpected error");
        var d=Term_dom_S_inner2.sub;
        var e=Term_dom_S_inner2.inner1;
        if (equal(e,"0")){ //3.4.2.1
          if (isNat(T)&&(Term_fund_S_fund_T_0=new Term(fund(S,fund(T,"0")))) instanceof PsiTerm&&equal(Term_fund_S_fund_T_0.sub,S.sub)&&equal(Term_fund_S_fund_T_0.inner1,S.inner1)) return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,"ψ_"+fund(d,"0")+"("+Term_fund_S_fund_T_0.inner2+",0)")+")"; //3.4.2.1.1
          else return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,"ψ_"+fund(d,"0")+"("+e+",0)")+")"; //3.4.2.1.2
        }else{ //3.4.2.2
          if (isNat(T)&&(Term_fund_S_fund_T_0=new Term(fund(S,fund(T,"0")))) instanceof PsiTerm&&equal(Term_fund_S_fund_T_0.sub,S.sub)&&equal(Term_fund_S_fund_T_0.inner1,S.inner1)) return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,"ψ_"+d+"("+fund(e,"0")+","+Term_fund_S_fund_T_0.inner2+")")+")"; //3.4.2.2.1
          else return "ψ_"+S.sub+"("+S.inner1+","+fund(S.inner2,"ψ_"+d+"("+fund(e,"0")+",0)")+")"; //3.4.2.2.2
        }
      }
    }
  }
  throw Error("No rule to compute fund of "+S+","+T);
}
function findOTPath(x,limit){
  x=normalizeAbbreviations(x);
  if (!inT(x)) throw Error("Invalid argument: "+x);
  if (typeof limit=="undefined"||limit==-1) limit=Infinity;
  if (equal(x,"0")){
    return {isStandard:true,path:["0"],funds:[-1]};
  }else{
    var n=0;
    var t;
    while(n<=limit&&!lessThanOrEqual(x,limitOrd(n))){
      n++;
    };
    if (n>limit) return {isStandard:false,path:[],funds:[]};
    t=limitOrd(n);
    console.log(abbreviate(t));
    var r={isStandard:false,path:[t],funds:[n]};
    while (!equal(x,t)){
      n=0;
      var nt;
      while (n<=limit&&lessThan(nt=fund(t,n),x)) n++;
      if (n>limit) return r;
      r.path.push(t=nt);
      r.funds.push(n);
      console.log(abbreviate(nt));
    }
    r.isStandard=true;
    return r;
  }
}
function isStandard(x,limit){
  return findOTPath(x,limit).isStandard;
}
/**
 * @param {number} n 
 * @returns {string} ψ_0(ψ_n(0))
 */
function limitOrd(n){
  return "ψ_0(0,"+"ψ_".repeat(n+1)+"0"+"(0,0)".repeat(n+1)+")";
}
/**
 * @param {string} S 
 * @param {number} n 
 * @returns {number}
 */
function FGH(S,n){
  S=normalizeAbbreviations(S);
  if (!isStandard(S)||(typeof n!="number")) throw Error("Invalid argument: "+S);
  if (equal(S,"0")) return n+1;
  else if (equal(dom(S),"1")){
    var r=n;
    var X0=fund(S,"0");
    for (var i=0;i<n;i++) r=FGH(X0,r);
    return r;
  }else return FGH(fund(S,n),n);
}
/**
 * @param {number} n 
 * @returns {number}
 */
function largeFunction(n){
  if (typeof n!="number") throw Error("Invalid argument");
  var ord=limitOrd(n);
  var r=n;
  for (var i=0;i<n;i++) r=FGH(ord,r);
  return r;
}
function calculateN(){
  return largeFunction(1e100);
}

var input="";
var options={
  abbreviate:undefined,
  detail:undefined
}
var last=null;
function compute(){
  if (input==dg("input").value&&options.abbreviate==dg("abbreviate").checked&&options.detail==dg("detail").checked) return;
  var oldinput=input;
  input=dg("input").value;
  options.abbreviate=dg("abbreviate").checked;
  options.detail=dg("detail").checked;
  if (oldinput!=input) last=[];
  var output="";
  var lines=input.split(lineBreakRegex);
  function abbreviateIfEnabled(x){
    if (options.abbreviate) return abbreviate(x);
    else return x;
  }
  for (var l=0;l<lines.length;l++){
    var line=lines[l];
    var args=line.split(itemSeparatorRegex);
    var cmd=args.shift();
    output+=line+"\n";
    var result;
    if (oldinput!=input){
      try{
        if (cmd=="normalize"||cmd=="norm"){
          result=normalizeAbbreviations(args[0]);
        }else if (cmd=="abbreviate"||cmd=="abbr"){
          result=abbreviate(args[0]);
        }else if (cmd=="lessThan"||cmd=="<"){
          result=lessThan(args[0],args[1]);
        }else if (cmd=="lessThanOrEqual"||cmd=="<="){
          result=lessThanOrEqual(args[0],args[1]);
        }else if (cmd=="dom"){
          result=dom(args[0]);
        }else if (cmd=="expand"){
          var t=normalizeAbbreviations(args[0]);
          result=[t];
          for (var i=1;i<args.length;i++){
            result.push(t=fund(t,args[i]));
          }
        }else if (cmd=="isStandard"){
          result=findOTPath(args[0],args[1]||3);
        }else{
          result=null;
        }
      }catch(e){
        result=e;
        console.error(e);
      }
      last[l]=result;
    }else result=last[l];
    if (result instanceof Error){
      output+=result.stack?result.stack:result;
    }else if (cmd=="normalize"||cmd=="norm"){
      output+=result;
    }else if (cmd=="abbreviate"||cmd=="abbr"){
      output+=result;
    }else if (cmd=="lessThan"||cmd=="<"){
      output+=result;
    }else if (cmd=="lessThanOrEqual"||cmd=="<="){
      output+=result;
    }else if (cmd=="dom"){
      output+=abbreviateIfEnabled(result);
    }else if (cmd=="expand"){
      if (options.detail){
        for (var i=1;i<result.length;i++){
          output+=abbreviateIfEnabled(result[i-1])+"["+args[i]+"]="+abbreviateIfEnabled(result[i])+(i==result.length-1?"":"\n");
        }
      }else{
        output+=abbreviateIfEnabled(result[result.length-1]);
      }
    }else if (cmd=="isStandard"){
      if (options.detail){
        for (var i=1;i<result.path.length;i++){
          output+=abbreviateIfEnabled(result.path[i-1])+"["+result.funds[i]+"]="+abbreviateIfEnabled(result.path[i])+"\n";
        }
        if (result.isStandard) output+=abbreviateIfEnabled(args[0])+"∈OT";
        else output+=abbreviateIfEnabled(args[0])+"∉OT limited to n≦"+(args[1]||3);
      }else{
        output+=result.isStandard;
      }
    }else{
      output+="Unknown command "+cmd;
    }
    output+="\n\n";
  }
  dg("output").value=output;
}
window.onpopstate=function (e){
  compute();
}
var handlekey=function(e){}
//console.log=function (s){alert(s)};
window.onerror=function (e,s,l,c,o){alert(JSON.stringify(e+"\n"+s+":"+l+":"+c+"\n"+(o&&o.stack)))};