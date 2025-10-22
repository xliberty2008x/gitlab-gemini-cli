# Addressables Lifecycle Patterns

## Core Principle

**Every Load must have a Release.**  
**Every Instantiate must have a ReleaseInstance.**

Addressables uses reference counting. Missing releases = memory leaks.

## Pattern 1: LoadAssetAsync → Release

Use when loading asset references (prefabs, scriptable objects, textures) that you'll instantiate manually or use directly.

```csharp
// ✅ CORRECT: Load asset, instantiate, then release asset
public async UniTask SpawnEnemyAsync() {
    // Load the prefab asset
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    
    // Instantiate from loaded asset
    var instance = Object.Instantiate(prefab);
    
    // Release the ASSET (not the instance)
    Addressables.Release(handle);
    
    // Later, when done with instance:
    Object.Destroy(instance);
}
```

**When to use:**
- Loading prefab references to instantiate multiple times
- Loading ScriptableObjects
- Loading textures/sprites to assign to materials
- Preloading assets before gameplay

## Pattern 2: InstantiateAsync → ReleaseInstance

Use when you want Addressables to handle both loading AND instantiation.

```csharp
// ✅ CORRECT: InstantiateAsync + ReleaseInstance
public async UniTask SpawnEnemyAsync() {
    // Load AND instantiate in one call
    var handle = Addressables.InstantiateAsync("Enemy", parent: _enemyContainer);
    var instance = await handle.Task;
    
    // Use the instance...
    
    // When done, use ReleaseInstance (not Destroy!)
    Addressables.ReleaseInstance(instance);
}
```

**When to use:**
- Loading and spawning objects directly
- Managing GameObject lifecycle through Addressables
- Pooling with Addressables (uses internal pool)

**Benefits:**
- Automatic asset loading + instantiation
- Automatic cleanup when all instances released
- Built-in pooling support

## Pattern 3: Handle Management

**Option A: Store handles, release later**
```csharp
public class EnemySpawner {
    private List<AsyncOperationHandle<GameObject>> _handles = new();
    
    public async UniTask SpawnAsync(string key) {
        var handle = Addressables.InstantiateAsync(key);
        _handles.Add(handle);
        var instance = await handle.Task;
        // Use instance...
    }
    
    public void Cleanup() {
        foreach (var handle in _handles) {
            if (handle.IsValid()) {
                Addressables.Release(handle);
            }
        }
        _handles.Clear();
    }
}
```

**Option B: Store instances, release by instance**
```csharp
public class EnemySpawner {
    private List<GameObject> _spawnedEnemies = new();
    
    public async UniTask SpawnAsync(string key) {
        var handle = Addressables.InstantiateAsync(key);
        var instance = await handle.Task;
        _spawnedEnemies.Add(instance);
    }
    
    public void Cleanup() {
        foreach (var enemy in _spawnedEnemies) {
            Addressables.ReleaseInstance(enemy);
        }
        _spawnedEnemies.Clear();
    }
}
```

## Common Mistakes

### ❌ Mistake 1: Using wrong release method

```csharp
// ❌ WRONG: Release on instance from InstantiateAsync
var handle = Addressables.InstantiateAsync("Enemy");
var instance = await handle.Task;
Addressables.Release(instance); // WRONG! This is a GameObject, not an asset

// ✅ CORRECT: Use ReleaseInstance
Addressables.ReleaseInstance(instance);

// ❌ WRONG: ReleaseInstance on manually instantiated object
var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
var prefab = await handle.Task;
var instance = Instantiate(prefab);
Addressables.ReleaseInstance(instance); // WRONG! Addressables didn't instantiate this

// ✅ CORRECT: Release the handle, Destroy the instance
Addressables.Release(handle);
Destroy(instance);
```

### ❌ Mistake 2: Missing release

```csharp
// ❌ MEMORY LEAK: No release
public async UniTask LoadEnemy() {
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    _enemyPrefab = prefab;
    // Missing: Addressables.Release(handle);
}

// ✅ CORRECT: Always release
public async UniTask LoadEnemy() {
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    _enemyPrefab = prefab;
    _enemyHandle = handle; // Store for later release
}

public void Cleanup() {
    if (_enemyHandle.IsValid()) {
        Addressables.Release(_enemyHandle);
    }
}
```

### ❌ Mistake 3: Releasing too early

```csharp
// ❌ WRONG: Asset released but still using instance
public async UniTask SpawnEnemy() {
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    var instance = Instantiate(prefab);
    
    Addressables.Release(handle); // ❌ Released asset
    
    // Later in the frame or next frame:
    instance.GetComponent<Enemy>().Initialize(); // ❌ May crash if asset unloaded
}

// ✅ CORRECT: Keep asset loaded while instances exist
private AsyncOperationHandle<GameObject> _enemyHandle;
private List<GameObject> _enemies = new();

public async UniTask LoadEnemyPrefab() {
    _enemyHandle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    await _enemyHandle.Task;
}

public void SpawnEnemy() {
    var instance = Instantiate(_enemyHandle.Result);
    _enemies.Add(instance);
}

public void Cleanup() {
    foreach (var enemy in _enemies) {
        Destroy(enemy);
    }
    _enemies.Clear();
    
    if (_enemyHandle.IsValid()) {
        Addressables.Release(_enemyHandle); // Now safe to release
    }
}
```

### ❌ Mistake 4: Multiple loads without caching

```csharp
// ❌ BAD: Loading same asset multiple times
public async UniTask SpawnEnemy() {
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    Instantiate(prefab);
    Addressables.Release(handle);
}

// Called 100 times = 100 load operations!

// ✅ GOOD: Load once, instantiate many times
private GameObject _enemyPrefab;
private AsyncOperationHandle<GameObject> _enemyHandle;

public async UniTask PreloadAsync() {
    _enemyHandle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    _enemyPrefab = await _enemyHandle.Task;
}

public void SpawnEnemy() {
    Instantiate(_enemyPrefab); // No load needed!
}

public void Cleanup() {
    if (_enemyHandle.IsValid()) {
        Addressables.Release(_enemyHandle);
    }
}
```

## Scene Loading

```csharp
// ✅ Load scene
public async UniTask LoadGameSceneAsync() {
    var handle = Addressables.LoadSceneAsync("GameScene", LoadSceneMode.Additive);
    await handle.Task;
    _sceneHandle = handle; // Store for unload
}

// ✅ Unload scene
public async UniTask UnloadGameSceneAsync() {
    if (_sceneHandle.IsValid()) {
        await Addressables.UnloadSceneAsync(_sceneHandle).Task;
    }
}
```

## Asset Preloading Pattern

Use when you need assets ready before gameplay starts.

```csharp
public class GameAssetLoader {
    private Dictionary<string, AsyncOperationHandle> _loadedAssets = new();
    
    public async UniTask PreloadAsync(List<string> keys) {
        var tasks = new List<UniTask>();
        
        foreach (var key in keys) {
            var handle = Addressables.LoadAssetAsync<GameObject>(key);
            _loadedAssets[key] = handle;
            tasks.Add(handle.ToUniTask());
        }
        
        await UniTask.WhenAll(tasks);
    }
    
    public GameObject GetAsset(string key) {
        if (_loadedAssets.TryGetValue(key, out var handle)) {
            return handle.Result as GameObject;
        }
        return null;
    }
    
    public void ReleaseAll() {
        foreach (var handle in _loadedAssets.Values) {
            if (handle.IsValid()) {
                Addressables.Release(handle);
            }
        }
        _loadedAssets.Clear();
    }
}
```

## Dependency Management

Addressables handles dependencies automatically:

```csharp
// Material references texture → Addressables loads both
var handle = Addressables.LoadAssetAsync<Material>("GlowMaterial");
var material = await handle.Task;
// Texture is loaded automatically as dependency

// When you release the material, texture is released too (if no other refs)
Addressables.Release(handle);
```

## Reference Counting

Addressables uses reference counting:

```csharp
// Load same asset twice = refcount 2
var handle1 = Addressables.LoadAssetAsync<GameObject>("Enemy");
var handle2 = Addressables.LoadAssetAsync<GameObject>("Enemy");

await UniTask.WhenAll(handle1.ToUniTask(), handle2.ToUniTask());

// Must release BOTH handles
Addressables.Release(handle1); // refcount = 1, asset still loaded
Addressables.Release(handle2); // refcount = 0, asset unloaded
```

## Exception Handling

```csharp
// ✅ Always handle load failures
public async UniTask<GameObject> LoadAssetSafeAsync(string key) {
    var handle = Addressables.LoadAssetAsync<GameObject>(key);
    
    try {
        var asset = await handle.Task;
        return asset;
    } catch (Exception ex) {
        Debug.LogError($"Failed to load {key}: {ex.Message}");
        
        // Still release handle even on failure
        if (handle.IsValid()) {
            Addressables.Release(handle);
        }
        
        return null;
    }
}
```

## Performance Tips

1. **Preload assets** before they're needed (loading screens, scene transitions)
2. **Batch loads** using `Addressables.LoadAssetsAsync` with labels
3. **Cache frequently used assets** instead of loading repeatedly
4. **Use labels** to organize and batch-load related assets
5. **Profile memory** with Addressables Event Viewer

## Checklist for Addressables Code Review

- [ ] Every `LoadAssetAsync` has corresponding `Release(handle)`
- [ ] Every `InstantiateAsync` has corresponding `ReleaseInstance(instance)`
- [ ] No mixing of `Release` and `ReleaseInstance`
- [ ] Handles stored for later release if needed
- [ ] No duplicate loads of same asset
- [ ] Exception handling around async operations
- [ ] Scene handles stored for proper unload
- [ ] No early releases while instances still active
