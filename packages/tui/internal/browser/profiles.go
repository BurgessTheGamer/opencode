package browser

import (
	"fmt"
	"time"
)

// CreateProfile creates a new browser profile
func (e *Engine) CreateProfile(params CreateProfileParams) (*Profile, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Check if profile already exists
	if _, exists := e.profiles[params.Name]; exists {
		return nil, fmt.Errorf("profile already exists: %s", params.Name)
	}

	// Create new profile
	profile := &Profile{
		ID:        params.Name,
		Name:      params.Name,
		Created:   time.Now(),
		UserAgent: params.UserAgent,
		Viewport:  params.Viewport,
		Proxy:     params.Proxy,
	}

	// Set defaults
	if profile.UserAgent == "" {
		profile.UserAgent = randomUserAgent()
	}
	if profile.Viewport == nil {
		profile.Viewport = &Viewport{
			Width:  e.config.WindowSize.Width,
			Height: e.config.WindowSize.Height,
		}
	}

	// Store profile
	e.profiles[params.Name] = profile

	return profile, nil
}

// GetProfile retrieves a profile by name
func (e *Engine) GetProfile(name string) (*Profile, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	profile, exists := e.profiles[name]
	if !exists {
		return nil, fmt.Errorf("profile not found: %s", name)
	}

	return profile, nil
}

// DeleteProfile removes a profile
func (e *Engine) DeleteProfile(name string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	profile, exists := e.profiles[name]
	if !exists {
		return fmt.Errorf("profile not found: %s", name)
	}

	// Cancel Chrome context if active
	if profile.cancel != nil {
		profile.cancel()
	}

	// Remove from map
	delete(e.profiles, name)

	return nil
}

// ListProfiles returns all profiles
func (e *Engine) ListProfiles() ([]*Profile, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	profiles := make([]*Profile, 0, len(e.profiles))
	for _, profile := range e.profiles {
		// Create a copy without internal fields
		profileCopy := &Profile{
			ID:        profile.ID,
			Name:      profile.Name,
			Created:   profile.Created,
			UserAgent: profile.UserAgent,
			Viewport:  profile.Viewport,
			Proxy:     profile.Proxy,
		}
		profiles = append(profiles, profileCopy)
	}

	return profiles, nil
}
