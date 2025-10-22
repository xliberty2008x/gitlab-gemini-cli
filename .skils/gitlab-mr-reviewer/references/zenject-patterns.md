# Zenject Dependency Injection Patterns

## Core Principles

1. **Separation of concerns** - MonoBehaviours are Views, business logic lives in services
2. **Constructor injection** preferred over field injection
3. **Explicit bindings** - No automatic resolution
4. **Installers only bind** - No runtime work in installers
5. **Use IDs** when binding multiple instances of same type

## Pattern 1: View + Mediator

Separate presentation (MonoBehaviour) from business logic (plain C#).

```csharp
// ❌ BAD: Business logic in MonoBehaviour
public class EnemyView : MonoBehaviour {
    [Inject] private IGameState _gameState;
    [Inject] private IEnemySpawner _spawner;
    
    private float _health = 100f;
    
    void Update() {
        // Business logic mixed with Unity lifecycle
        if (_health <= 0) {
            _gameState.OnEnemyDied(this);
            _spawner.RemoveEnemy(this);
            Destroy(gameObject);
        }
    }
    
    public void TakeDamage(float damage) {
        _health -= damage;
        // More business logic...
    }
}

// ✅ GOOD: View handles presentation, Mediator handles logic
public class EnemyView : MonoBehaviour {
    [SerializeField] private Animator _animator;
    [SerializeField] private HealthBar _healthBar;
    
    private EnemyMediator _mediator;
    
    [Inject]
    public void Construct(EnemyMediator mediator) {
        _mediator = mediator;
        _mediator.OnHealthChanged += UpdateHealthBar;
        _mediator.OnDied += PlayDeathAnimation;
    }
    
    private void UpdateHealthBar(float normalized) {
        _healthBar.SetFill(normalized);
    }
    
    private void PlayDeathAnimation() {
        _animator.Play("Death");
    }
}

public class EnemyMediator {
    private readonly IGameState _gameState;
    private readonly EnemyData _data;
    
    public event Action<float> OnHealthChanged;
    public event Action OnDied;
    
    private float _currentHealth;
    
    public EnemyMediator(IGameState gameState, EnemyData data) {
        _gameState = gameState;
        _data = data;
        _currentHealth = data.MaxHealth;
    }
    
    public void TakeDamage(float damage) {
        _currentHealth -= damage;
        OnHealthChanged?.Invoke(_currentHealth / _data.MaxHealth);
        
        if (_currentHealth <= 0) {
            _gameState.OnEnemyDied();
            OnDied?.Invoke();
        }
    }
}
```

## Pattern 2: Service Layer

Keep business logic in testable, injectable services.

```csharp
// ✅ Interface for flexibility
public interface IPlayerService {
    int CurrentHealth { get; }
    void TakeDamage(int damage);
    void Heal(int amount);
    event Action<int> OnHealthChanged;
}

// ✅ Implementation
public class PlayerService : IPlayerService {
    private readonly PlayerConfig _config;
    private readonly IGameState _gameState;
    
    public int CurrentHealth { get; private set; }
    public event Action<int> OnHealthChanged;
    
    public PlayerService(PlayerConfig config, IGameState gameState) {
        _config = config;
        _gameState = gameState;
        CurrentHealth = config.MaxHealth;
    }
    
    public void TakeDamage(int damage) {
        CurrentHealth = Mathf.Max(0, CurrentHealth - damage);
        OnHealthChanged?.Invoke(CurrentHealth);
        
        if (CurrentHealth == 0) {
            _gameState.OnPlayerDied();
        }
    }
    
    public void Heal(int amount) {
        CurrentHealth = Mathf.Min(_config.MaxHealth, CurrentHealth + amount);
        OnHealthChanged?.Invoke(CurrentHealth);
    }
}
```

## Pattern 3: Installer Organization

**Project Installer (Scene-independent):**
```csharp
public class ProjectInstaller : MonoInstaller {
    [SerializeField] private GameConfig _gameConfig;
    
    public override void InstallBindings() {
        // ✅ Bind singleton services
        Container.Bind<IGameState>().To<GameState>().AsSingle();
        Container.Bind<ISaveSystem>().To<SaveSystem>().AsSingle();
        Container.Bind<IAudioService>().To<AudioService>().AsSingle();
        
        // ✅ Bind config (instance already exists)
        Container.Bind<GameConfig>().FromInstance(_gameConfig).AsSingle();
        
        // ✅ Bind factories
        Container.BindFactory<Enemy, EnemyFactory>();
    }
}
```

**Scene Installer (Scene-specific):**
```csharp
public class GameSceneInstaller : MonoInstaller {
    [SerializeField] private EnemySpawner _enemySpawner;
    
    public override void InstallBindings() {
        // ✅ Bind scene-specific services
        Container.Bind<IEnemySpawner>()
            .To<EnemySpawner>()
            .FromInstance(_enemySpawner)
            .AsSingle();
        
        Container.Bind<IWaveManager>().To<WaveManager>().AsSingle();
        
        // ✅ Bind scene context
        Container.Bind<GameSceneContext>().AsSingle();
    }
}
```

## Pattern 4: Handling Multiple Bindings

### ❌ Problem: Ambiguous bindings

```csharp
// ❌ BAD: Two bindings for same interface, no way to distinguish
Container.Bind<IWeapon>().To<Sword>().AsSingle();
Container.Bind<IWeapon>().To<Bow>().AsSingle();

// Injection will fail - which IWeapon?
public class Player {
    [Inject] private IWeapon _weapon; // ❌ Ambiguous!
}
```

### ✅ Solution 1: Use IDs

```csharp
// ✅ GOOD: Use identifiers
Container.Bind<IWeapon>().WithId("Primary").To<Sword>().AsSingle();
Container.Bind<IWeapon>().WithId("Secondary").To<Bow>().AsSingle();

public class Player {
    private IWeapon _primaryWeapon;
    private IWeapon _secondaryWeapon;
    
    [Inject]
    public void Construct(
        [Inject(Id = "Primary")] IWeapon primary,
        [Inject(Id = "Secondary")] IWeapon secondary) {
        _primaryWeapon = primary;
        _secondaryWeapon = secondary;
    }
}
```

### ✅ Solution 2: Different interfaces

```csharp
// ✅ GOOD: Specific interfaces
public interface IPrimaryWeapon : IWeapon { }
public interface ISecondaryWeapon : IWeapon { }

Container.Bind<IPrimaryWeapon>().To<Sword>().AsSingle();
Container.Bind<ISecondaryWeapon>().To<Bow>().AsSingle();

public class Player {
    private readonly IPrimaryWeapon _primaryWeapon;
    private readonly ISecondaryWeapon _secondaryWeapon;
    
    public Player(IPrimaryWeapon primary, ISecondaryWeapon secondary) {
        _primaryWeapon = primary;
        _secondaryWeapon = secondary;
    }
}
```

### ✅ Solution 3: Collections

```csharp
// ✅ GOOD: Bind as list
Container.Bind<IWeapon>().To<Sword>().AsSingle();
Container.Bind<IWeapon>().To<Bow>().AsSingle();

public class WeaponManager {
    private readonly List<IWeapon> _allWeapons;
    
    public WeaponManager(List<IWeapon> weapons) {
        _allWeapons = weapons; // Gets all IWeapon bindings
    }
}
```

## Pattern 5: Avoiding Circular Dependencies

```csharp
// ❌ BAD: Circular dependency
public class PlayerService {
    public PlayerService(IEnemyService enemyService) { }
}

public class EnemyService {
    public EnemyService(IPlayerService playerService) { } // ❌ Circular!
}

// ✅ GOOD: Introduce mediator/event system
public class PlayerService {
    private readonly IGameEvents _events;
    
    public PlayerService(IGameEvents events) {
        _events = events;
        _events.OnEnemyDied += HandleEnemyDied;
    }
}

public class EnemyService {
    private readonly IGameEvents _events;
    
    public EnemyService(IGameEvents events) {
        _events = events;
        _events.OnPlayerDied += HandlePlayerDied;
    }
}
```

## Pattern 6: Factory Pattern

Use factories to create objects that need both injected dependencies and runtime parameters.

```csharp
// ✅ Define factory interface
public class Enemy {
    private readonly IGameState _gameState;
    private readonly EnemyData _data;
    
    public Enemy(IGameState gameState, EnemyData data) {
        _gameState = gameState;
        _data = data;
    }
}

// ✅ Bind factory
public class GameInstaller : MonoInstaller {
    public override void InstallBindings() {
        Container.BindFactory<EnemyData, Enemy, EnemyFactory>();
    }
}

// ✅ Use factory
public class EnemySpawner {
    private readonly EnemyFactory _factory;
    
    public EnemySpawner(EnemyFactory factory) {
        _factory = factory;
    }
    
    public Enemy SpawnEnemy(EnemyData data) {
        return _factory.Create(data); // Factory injects IGameState automatically
    }
}
```

## Pattern 7: Installer Responsibilities

**✅ DO in Installers:**
- Bind types to interfaces
- Set up factories
- Configure object lifetimes (AsSingle, AsTransient, etc.)
- Bind config data

**❌ DON'T in Installers:**
- Create game objects
- Perform async operations
- Access other services
- Do initialization work

```csharp
// ❌ BAD: Doing work in installer
public class BadInstaller : MonoInstaller {
    public override void InstallBindings() {
        Container.Bind<IDataService>().To<DataService>().AsSingle();
        
        // ❌ Don't do this!
        var service = Container.Resolve<IDataService>();
        service.Initialize(); // Runtime work!
    }
}

// ✅ GOOD: Use IInitializable
public class DataService : IDataService, IInitializable {
    public void Initialize() {
        // Initialization logic here
    }
}

public class GoodInstaller : MonoInstaller {
    public override void InstallBindings() {
        Container.BindInterfacesAndSelfTo<DataService>().AsSingle();
        // Zenject will call Initialize() automatically
    }
}
```

## Pattern 8: MonoBehaviour Injection

**Prefer constructor injection, but for MonoBehaviours use method injection:**

```csharp
// ❌ Less preferred: Field injection (harder to test)
public class PlayerView : MonoBehaviour {
    [Inject] private IPlayerService _playerService;
}

// ✅ Preferred: Method injection (explicit, testable)
public class PlayerView : MonoBehaviour {
    private IPlayerService _playerService;
    
    [Inject]
    public void Construct(IPlayerService playerService) {
        _playerService = playerService;
        // Can initialize here with dependencies
        _playerService.OnHealthChanged += UpdateHealthDisplay;
    }
}
```

## Lifetime Scopes

**AsSingle:**
```csharp
// ✅ One instance shared across entire container
Container.Bind<IGameState>().To<GameState>().AsSingle();
```

**AsTransient:**
```csharp
// ✅ New instance every time
Container.Bind<IBullet>().To<Bullet>().AsTransient();
```

**FromInstance:**
```csharp
// ✅ Use existing instance
[SerializeField] private AudioSource _audioSource;

Container.Bind<AudioSource>().FromInstance(_audioSource).AsSingle();
```

## Testing with Zenject

```csharp
// ✅ Unit test with dependency injection
[Test]
public void PlayerTakesDamage_ReducesHealth() {
    // Arrange
    var mockGameState = new Mock<IGameState>();
    var config = new PlayerConfig { MaxHealth = 100 };
    var player = new PlayerService(config, mockGameState.Object);
    
    // Act
    player.TakeDamage(30);
    
    // Assert
    Assert.AreEqual(70, player.CurrentHealth);
}
```

## Common Mistakes Checklist

- [ ] No business logic in MonoBehaviours
- [ ] No circular dependencies
- [ ] Multiple bindings use IDs or different interfaces
- [ ] Installers only bind, don't initialize
- [ ] Constructor injection for plain C# classes
- [ ] Method injection for MonoBehaviours
- [ ] Services implement interfaces
- [ ] Factories used for objects needing runtime parameters
- [ ] Use AsSingle for singleton services
- [ ] Use AsTransient for short-lived objects
