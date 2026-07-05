import { ComplexDomain }      from './complex-domain.js';
import { PhasePortrait }      from './phase-portrait.js';
import { FourierAnalysis }    from './fourier.js';
import { Chaos }              from './chaos.js';
import { EllipticCurve }      from './elliptic.js';
import { HyperbolicGeometry } from './hyperbolic.js';
import { NumberTheory }       from './number-theory.js';
import { LinearAlgebra }      from './linalg.js';
import { Probability }        from './probability.js';
import { Surfaces }           from './surfaces.js';
import { Fractal }            from './fractal.js';
import { LSystem }            from './lsystem.js';
import { NumericalMethods }   from './numerical.js';
import { DoublePendulum }     from './pendulum.js';
import { Waves }              from './waves.js';
import { Optimization }       from './optimization.js';
import { SignalProcessing }   from './signals.js';
import { ZetaFunction }       from './zeta.js';
import { IsingModel }         from './ising.js';
import { ContinuedFractions } from './continued-fractions.js';
import { KnotTheory }         from './knots.js';
import { DiffGeo }            from './diffgeo.js';
import { LieGroups }          from './liegroups.js';
import { RandomMatrix }       from './random-matrix.js';
import { PAdicNumbers }       from './padic.js';
import { ModularForms }       from './modular.js';
import { Computability }      from './computability.js';
import { ControlTheory }      from './control.js';
import { Combinatorics }      from './combinatorics.js';
import { GraphTheory }        from './graph.js';
import { GroupTheory }        from './group.js';
import { SpecialFunctions }   from './special-functions.js';
import { GameTheory }         from './game-theory.js';
import { InformationTheory }  from './information-theory.js';
import { Percolation }        from './percolation.js';
import { IteratedFunctionSystem } from './ifs.js';

export const SYSTEMS = [
  // ── Analysis ──────────────────────────────────────────────────
  { id:'complex-domain', name:'Complex Functions',    group:'Analysis', dot:'#1a4fa8', sub:'domain coloring',            create:(W,H)=>new ComplexDomain(W,H) },
  { id:'phase-portrait', name:'Phase Portraits',       group:'Analysis', dot:'#1a6b1a', sub:'ODE systems',                create:(W,H)=>new PhasePortrait(W,H) },
  { id:'fourier',        name:'Fourier Analysis',      group:'Analysis', dot:'#c42020', sub:'epicycles & DFT',            create:(W,H)=>new FourierAnalysis(W,H) },
  { id:'signals',        name:'Signal Processing',     group:'Analysis', dot:'#a05000', sub:'FFT, filters, aliasing',     create:(W,H)=>new SignalProcessing(W,H) },
  { id:'special-functions', name:'Special Functions',  group:'Analysis', dot:'#6020a0', sub:'Gamma, Bessel, elliptic',    create:(W,H)=>new SpecialFunctions(W,H) },

  // ── Analytic Number Theory ───────────────────────────────────
  { id:'zeta',           name:'Riemann Zeta Function',   group:'Analytic Number Theory', dot:'#6020a0', sub:'\u03b6(s), critical line, primes', create:(W,H)=>new ZetaFunction(W,H) },
  { id:'number-theory',  name:'Number Theory',           group:'Analytic Number Theory', dot:'#a05000', sub:'primes, Collatz, mod',             create:(W,H)=>new NumberTheory(W,H) },
  { id:'continued-fractions', name:'Continued Fractions', group:'Analytic Number Theory', dot:'#1a7a7a', sub:'Stern-Brocot, Farey, \u03c6',       create:(W,H)=>new ContinuedFractions(W,H) },
  { id:'padic',          name:'p-adic Numbers',           group:'Analytic Number Theory', dot:'#884400', sub:'ultrametric, Hensel',              create:(W,H)=>new PAdicNumbers(W,H) },

  // ── Dynamical Systems ─────────────────────────────────────────
  { id:'chaos',          name:'Chaos & Bifurcation',    group:'Dynamical Systems', dot:'#a05000', sub:'logistic map, Lyapunov', create:(W,H)=>new Chaos(W,H) },
  { id:'pendulum',       name:'Double Pendulum',         group:'Dynamical Systems', dot:'#c42020', sub:'Lagrangian chaos',       create:(W,H)=>new DoublePendulum(W,H) },
  { id:'fractal',        name:'Fractal Explorer',        group:'Dynamical Systems', dot:'#6020a0', sub:'Mandelbrot, Julia, \u2026', create:(W,H)=>new Fractal(W,H) },
  { id:'ifs',            name:'Iterated Function Systems',group:'Dynamical Systems', dot:'#1a6b1a', sub:'chaos game, Barnsley fern', create:(W,H)=>new IteratedFunctionSystem(W,H) },

  // ── Algebra & Arithmetic Geometry ─────────────────────────────
  { id:'elliptic',       name:'Elliptic Curves',         group:'Algebra & Arithmetic Geometry', dot:'#1a7a7a', sub:'group law, chord-tangent', create:(W,H)=>new EllipticCurve(W,H) },
  { id:'linalg',         name:'Linear Algebra',           group:'Algebra & Arithmetic Geometry', dot:'#c42020', sub:'matrix transforms, eigen', create:(W,H)=>new LinearAlgebra(W,H) },
  { id:'modular',        name:'Modular Forms',             group:'Algebra & Arithmetic Geometry', dot:'#6020a0', sub:'j-invariant, SL(2,\u2124)', create:(W,H)=>new ModularForms(W,H) },
  { id:'liegroups',      name:'Lie Groups',                 group:'Algebra & Arithmetic Geometry', dot:'#1a4fa8', sub:'SO(3), quaternions',       create:(W,H)=>new LieGroups(W,H) },

  // ── Abstract Algebra & Combinatorics ──────────────────────────
  { id:'group',          name:'Group Theory',            group:'Abstract Algebra & Combinatorics', dot:'#c42020', sub:'symmetry, Cayley graphs',   create:(W,H)=>new GroupTheory(W,H) },
  { id:'combinatorics',  name:'Combinatorics',            group:'Abstract Algebra & Combinatorics', dot:'#1a6b1a', sub:'Pascal, Catalan, partitions',create:(W,H)=>new Combinatorics(W,H) },
  { id:'graph',          name:'Graph Theory & Networks',   group:'Abstract Algebra & Combinatorics', dot:'#1a4fa8', sub:'random graphs, spectral',   create:(W,H)=>new GraphTheory(W,H) },

  // ── Geometry & Topology ───────────────────────────────────────
  { id:'hyperbolic',     name:'Hyperbolic Geometry',      group:'Geometry & Topology', dot:'#1a4fa8', sub:'Poincar\u00e9 disk',          create:(W,H)=>new HyperbolicGeometry(W,H) },
  { id:'surfaces',       name:'Parametric Surfaces',      group:'Geometry & Topology', dot:'#6020a0', sub:'topology, curvature',        create:(W,H)=>new Surfaces(W,H) },
  { id:'diffgeo',        name:'Differential Geometry',    group:'Geometry & Topology', dot:'#a05000', sub:'curvature, torsion, Frenet',  create:(W,H)=>new DiffGeo(W,H) },
  { id:'knots',          name:'Knot Theory',                group:'Geometry & Topology', dot:'#1a6b1a', sub:'torus knots, braids',       create:(W,H)=>new KnotTheory(W,H) },

  // ── Mathematical Physics ──────────────────────────────────────
  { id:'waves',          name:'Wave & Heat Equations',     group:'Mathematical Physics', dot:'#1a7a7a', sub:'PDE finite differences',   create:(W,H)=>new Waves(W,H) },
  { id:'ising',          name:'Ising Model',                 group:'Mathematical Physics', dot:'#c42020', sub:'phase transitions, Monte Carlo', create:(W,H)=>new IsingModel(W,H) },
  { id:'percolation',    name:'Percolation Theory',           group:'Mathematical Physics', dot:'#a05000', sub:'spanning clusters, p_c',   create:(W,H)=>new Percolation(W,H) },

  // ── Optimization & Numerical Analysis ─────────────────────────
  { id:'optimization',   name:'Optimization Landscape',    group:'Optimization & Numerical Analysis', dot:'#1a6b1a', sub:'gradient descent, Adam',  create:(W,H)=>new Optimization(W,H) },
  { id:'numerical',      name:'Numerical Methods',          group:'Optimization & Numerical Analysis', dot:'#884400', sub:'root-finding, Euler/RK4', create:(W,H)=>new NumericalMethods(W,H) },

  // ── Control Theory ────────────────────────────────────────────
  { id:'control',        name:'Control Theory',              group:'Control Theory', dot:'#c42020', sub:'PID, Bode, root locus, feedback', create:(W,H)=>new ControlTheory(W,H) },

  // ── Probability & Stochastic Processes ────────────────────────
  { id:'probability',    name:'Probability & Statistics',   group:'Probability & Stochastic Processes', dot:'#1a6b1a', sub:'walks, CLT, Markov',     create:(W,H)=>new Probability(W,H) },
  { id:'random-matrix',  name:'Random Matrix Theory',         group:'Probability & Stochastic Processes', dot:'#6020a0', sub:'GOE/GUE, semicircle law', create:(W,H)=>new RandomMatrix(W,H) },

  // ── Game Theory & Information ─────────────────────────────────
  { id:'game-theory',    name:'Game Theory',                  group:'Game Theory & Information', dot:'#a05000', sub:'Nash equilibria, evolution', create:(W,H)=>new GameTheory(W,H) },
  { id:'information',    name:'Information Theory',            group:'Game Theory & Information', dot:'#1a4fa8', sub:'entropy, Huffman, capacity', create:(W,H)=>new InformationTheory(W,H) },

  // ── Computability & Logic ─────────────────────────────────────
  { id:'computability',  name:'Computability Theory',          group:'Computability & Logic', dot:'#6020a0', sub:'Turing machines, \u03bb-calculus', create:(W,H)=>new Computability(W,H) },

  // ── Formal Systems ────────────────────────────────────────────
  { id:'lsystem',        name:'Formal Grammars (L-Systems)',group:'Formal Systems',     dot:'#888888', sub:'rewriting, fractals',    create:(W,H)=>new LSystem(W,H) },
];
