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
 * Copyright (c) 2013 Open Assessment Technologies S.A.
 * 
 */

use oat\tao\model\lock\LockManager;
use oat\tao\helpers\UserHelper;

/**
 * control the lock on a given resource
 * 
 * @author plichart
 * @package taoGroups
 * @license GPLv2  http://www.opensource.org/licenses/gpl-2.0.php
 */
class tao_actions_Lock extends tao_actions_CommonModule {

	public function __construct()
	{
		parent::__construct();
		$this->defaultData();
	}
	
	/**
	 * actions that get prevented by a lock are forwareded to this action
	 * parameter view is currently ignored
	 */
	public function locked() {
	    $resource = new core_kernel_classes_Resource($this->getRequestParameter('id'));
	    $lockData = LockManager::getImplementation()->getLockData($resource);
	
	    $this->setData('id', $resource->getUri());
	    $this->setData('label', $resource->getLabel());
	
	    $this->setData('lockDate', $lockData->getCreationTime());
	    $this->setData('ownerHtml', UserHelper::renderHtmlUser($lockData->getOwner()));

	    $currentUserId = common_session_SessionManager::getSession()->getUser()->getIdentifier();
	    $this->setData('isOwner',  $lockData->getOwner()->getUri() == $currentUserId);
	
	    $this->setData('destination', $this->getRequestParameter('destination'));
	    $this->setView('Lock/locked.tpl', 'tao');
	}
	
	public function release($uri)
	{  
        try {
            $success = LockManager::getImplementation()->releaseLock(
                new core_kernel_classes_Resource(tao_helpers_Uri::decode($uri)),
                common_session_SessionManager::getSession()->getUser()->getIdentifier()
            );
            return $this->returnJson(array(
                'success' => $success
            ));
            
        //the connected user is not the owner of the lock
        } catch (common_exception_Unauthorized $e) {
            
            return $this->returnJson(array(
            	'success' => false,
                'message' => __('You are not authorised to remove this lock')
            ));
        }
    }
	
}
