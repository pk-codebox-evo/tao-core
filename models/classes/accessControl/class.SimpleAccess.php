<?php
/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 * 
 * Copyright (c) 2013 (original work) Open Assessment Techonologies SA (under the project TAO-PRODUCT);
 * 
 */

/**
 * Simple ACL Implementation deciding whenever or not to allow access
 * strictly by the BASEUSER role and a whitelist
 * 
 * Not to be used in production, since testtakers cann access the backoffice
 *
 * @access public
 * @author Joel Bout, <joel@taotesting.com>
 * @package tao
 * @subpackage models_classes_accessControl
 */
class tao_models_classes_accessControl_SimpleAccess
    implements tao_models_classes_accessControl_AccessControl
{
    
    const WHITELIST_KEY = 'SimpleAclWhitelist';
    
    private $whitelist = null;
    
    /**
     * 
     */
    public function __construct() {
        $this->whitelist = (string)common_ext_ExtensionsManager::singleton()->getExtensionById('tao')->getConfig(self::WHITELIST_KEY);
    }
    
    /**
     * (non-PHPdoc)
     * @see tao_models_classes_accessControl_AccessControl::hasAccess()
     */
    public function hasAccess($extension, $controller, $action, $parameters) {
        $isUser = false;
        foreach (common_session_SessionManager::getSession()->getUserRoles() as $role) {
            if ($role->getUri() == INSTANCE_ROLE_BASEUSER) {
                $isUser = true;
                break;
            }
        }
        return $isUser || $this->inWhiteList($extension, $controller, $action);
    }
    
    public function applyRule(tao_models_classes_accessControl_AccessRule $rule) {
        if ($rule->getRole()->getUri() == INSTANCE_ROLE_ANONYMOUS) {
            $mask = $rule->getMask();
            $this->whitelist(
                isset($mask['ext']) ? $mask['ext'] : null,
                isset($mask['mod']) ? $mask['mod'] : null,
                isset($mask['act']) ? $mask['act'] : null
            );
        }
    }
    
    private function inWhiteList($extension, $controller, $action) {
        return strpos($this->whitelist, $extension.'::'.$controller.'::'.$action) !== false
            || strpos($this->whitelist, $extension.'::'.$controller.'::*') !== false
            || strpos($this->whitelist, $extension.'::*::*') !== false;
    }
    
    private function whiteList($extension, $controller, $action) {
        $entry = $extension.'::'.(is_null($controller) ? '*' : $controller).'::'.(is_null($action) ? '*' : $action);
        $this->whitelist = (string)common_ext_ExtensionsManager::singleton()->getExtensionById('tao')->getConfig(self::WHITELIST_KEY);
        $this->whitelist .= ','.$entry;
        $ext = common_ext_ExtensionsManager::singleton()->getExtensionById('tao');
        common_ext_ExtensionsManager::singleton()->getExtensionById('tao')->setConfig(self::WHITELIST_KEY, $this->whitelist);
    }
}