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
 * Copyright (c) 2002-2008 (original work) Public Research Centre Henri Tudor & University of Luxembourg (under the project TAO & TAO2);
 *               2009-2012 (update and modification) Public Research Centre Henri Tudor (under the project TAO-SUSTAIN & TAO-DEV);
 *               2013- (update and modification) Open Assessment Technologies SA;
 *
 */
namespace oat\tao\model\mvc;

use oat\oatbox\service\ServiceManager;
use oat\tao\helpers\Template;
use oat\tao\model\asset\AssetService;
use oat\tao\model\routing\TaoFrontController;
use oat\tao\model\routing\CliController;
use common_Profiler;
use common_Logger;
use common_ext_ExtensionsManager;
use common_report_Report as Report;
use tao_helpers_Context;
use tao_helpers_Request;
use tao_helpers_Uri;
use Exception;
use \oat\oatbox\service\ServiceInjectorAwareInterface;
use \oat\oatbox\service\ServiceInjectorAwareTrait;

/**
 * The Bootstrap Class enables you to drive the application flow for a given extenstion.
 * A bootstrap instance initialize the context and starts all the services:
 * 	- session
 *  - database
 *  - user
 *
 * And it's used to disptach the Control Loop
 *  - control the platform status (redirect to the maintenance page if it is required)
 *  - dispatch to the convenient action
 *  - control code exceptions
 *
 * @author Bertrand CHEVRIER <bertrand.chevrier@tudor.lu>
 * @package tao
 * @example
 * <code>
 *  $bootStrap = new BootStrap('tao');	//create the Bootstrap instance
 *  $bootStrap->start();				//start all the services
 *  $bootStrap->dispatch();				//dispatch the http request into the control loop
 * </code>
 */
class Bootstrap implements ServiceInjectorAwareInterface {
    
    use ServiceInjectorAwareTrait;
    
    const CONFIG_SESSION_HANDLER = 'session';

	/**
	 * @var boolean if the context has been started
	 */
	protected static $isStarted = false;

	/**
	 * @var boolean if the context has been dispatched
	 */
	protected static $isDispatched = false;

	/**
	 * Initialize the context
	 * @param string $configFile
	 * @param array $options
	 */
	public function __construct($configFile, $options = array())
	{
	    
	    require_once $configFile;
	    
            $this->setServiceInjector(common_ext_ExtensionsManager::singleton()
                    ->getExtensionById('generis')
                    ->getConfig('serviceInjector')
                    ->factory());
            
	    common_Profiler::singleton()->register();

		if(PHP_SAPI == 'cli'){
			tao_helpers_Context::load('SCRIPT_MODE');
		}
		else{
			tao_helpers_Context::load('APP_MODE');
		}

	}

	/**
	 * Check if the current context has been started
	 * @return boolean
	 */
	public static function isStarted()
	{
		return self::$isStarted;
	}

	/**
	 * Check if the current context has been dispatched
	 * @return boolean
	 */
	public static function isDispatched()
	{
		return self::$isDispatched;
	}

    /**
     * Check if the application is ready
     * @return {boolean} Return true if the application is ready
     */
    protected function isReady()
    {
        return defined('SYS_READY') ? SYS_READY : true;
    }

	/**
	 * Start all the services:
	 *  1. Start the session
	 *  2. Update the include path
	 *  3. Include the global helpers
	 *  4. Connect the current user to the generis API
	 *  5. Initialize the internationalization
	 *  6. Check the application' state
	 */
	public function start()
	{
		if(!self::$isStarted){
			$this->session();
			$this->setDefaultTimezone();
			$this->registerErrorhandler();
			self::$isStarted = true;
		}
		common_Profiler::stop('start');
	}
	
	protected function dispatchHttp()
	{
	    $isAjax = tao_helpers_Request::isAjax();
	    
	    if(tao_helpers_Context::check('APP_MODE')){
	        if(!$isAjax){
	            $this->scripts();
	        }
	    }
	    
	    //Catch all exceptions
	    try{
	        //the app is ready
	        if($this->isReady()){
	            $this->mvc();
	        }
	        //the app is not ready
	        else{
	            //the request is not an ajax request, redirect the user to the maintenance page
	            if(!$isAjax){
	                require_once Template::getTemplate('error/maintenance.tpl', 'tao');
	                //else throw an exception, this exception will be send to the client properly
	            }
	            else{
	    
	                throw new \common_exception_SystemUnderMaintenance();
	            }
	        }
	    }
	    catch(Exception $e){
	        $this->catchError($e);
	    }
	    
	    // explicitly close session
	    session_write_close();
	}
	
	protected function dispatchCli()
	{
	    $params = $_SERVER['argv'];
	    $file = array_shift($params);

	    if (count($params) < 1) {
	        $report = new Report(Report::TYPE_ERROR, __('No action specified'));
	    } else {
            $actionIdentifier = array_shift($params);
            $cliController = $this->getServiceInjector()->get('tao.routing.cli');
            $report = $cliController->runAction($actionIdentifier, $params);
	    }
	     
	    echo \helpers_Report::renderToCommandline($report);
	}

	/**
	 * Dispatch the current http request into the control loop:
	 *  1. Load the ressources
	 *  2. Start the MVC Loop from the ClearFW
     *  manage Exception:
	 */
	public function dispatch()
	{
		common_Profiler::start('dispatch');
		if(!self::$isDispatched){
		    if (PHP_SAPI == 'cli') {
		        $this->dispatchCli();
		    } else {
                $this->dispatchHttp();
		    }
            self::$isDispatched = true;
        }
        common_Profiler::stop('dispatch');
    }
    
    /**
     * Catch any errors
     * return a http response in function of client accepted mime type 
     *
     * @param Exception $exception
     */
    protected function catchError(Exception $exception)
    {
        $Interpretor = new error\ExceptionInterpretor();
        $Interpretor->setException($exception)->getResponse()->send();
    }

    /**
     * Start the session
     */
    protected function session()
    {
        if (tao_helpers_Context::check('APP_MODE')) {
            // Set a specific ID to the session.
            $request = new \Request();
            if ($request->hasParameter('session_id')) {
                session_id($request->getParameter('session_id'));
            }
        }
        
        // set the session cookie to HTTP only.
        
        $this->configureSessionHandler();
  
        $sessionParams = session_get_cookie_params();
        $cookieDomain = ((true == tao_helpers_Uri::isValidAsCookieDomain(ROOT_URL)) ? tao_helpers_Uri::getDomain(ROOT_URL) : $sessionParams['domain']);
        session_set_cookie_params($sessionParams['lifetime'], tao_helpers_Uri::getPath(ROOT_URL), $cookieDomain, $sessionParams['secure'], TRUE);
        session_name(GENERIS_SESSION_NAME);
        
        if (isset($_COOKIE[GENERIS_SESSION_NAME])) {
            
            // Resume the session
            session_start();
            
            //cookie keep alive, if lifetime is not 0
            if ($sessionParams['lifetime'] !== 0) {
                $expiryTime = $sessionParams['lifetime'] + time();
                setcookie(session_name(), session_id(), $expiryTime, tao_helpers_Uri::getPath(ROOT_URL), $cookieDomain, $sessionParams['secure'], true);
            }
        }
	}
	
    private function configureSessionHandler() {
        $sessionHandler = common_ext_ExtensionsManager::singleton()->getExtensionById('tao')->getConfig(self::CONFIG_SESSION_HANDLER);
        if ($sessionHandler !== false) {
            session_set_save_handler(
                array($sessionHandler, 'open'),
                array($sessionHandler, 'close'),
                array($sessionHandler, 'read'),
                array($sessionHandler, 'write'),
                array($sessionHandler, 'destroy'),
                array($sessionHandler, 'gc')
            );
        }
    }
    
	/**
	 * register a custom Errorhandler
	 */
	protected function registerErrorhandler()
	{
		// register the logger as erorhandler
		common_Logger::singleton()->register();
	}

	/**
	 * Set Timezone quickfix
	 */
	protected function setDefaultTimezone()
	{
	    if(function_exists("date_default_timezone_set") && defined('TIME_ZONE')){
	        date_default_timezone_set(TIME_ZONE);
	    }
	}

	/**
	 *  Start the MVC Loop from the ClearFW
	 *  @throws ActionEnforcingException in case of wrong module or action
	 *  @throws tao_models_classes_UserException when a request try to acces a protected area
	 */
    protected function mvc()
    {
        $re = \common_http_Request::currentRequest();
        $fc = $this->getServiceInjector()->get('tao.routing.controller');
        $fc->init($this->getServiceInjector())->legacy($re);
    }

	/**
	 * Load external resources for the current context
	 * @see tao_helpers_Scriptloader
	 */
	protected function scripts()
	{
	    $assetService = $this->getServiceManager()->get(AssetService::SERVICE_ID);
        $cssFiles = array(
			$assetService->getJsBaseWww('tao') . 'css/layout.css',
			$assetService->getJsBaseWww('tao') . 'css/tao-main-style.css',
			$assetService->getJsBaseWww('tao') . 'css/tao-3.css'
        );

        //stylesheets to load
        \tao_helpers_Scriptloader::addCssFiles($cssFiles);

        if(\common_session_SessionManager::isAnonymous()) {
            \tao_helpers_Scriptloader::addCssFile(
				$assetService->getJsBaseWww('tao') . 'css/portal.css'
            );
        }
    }

	private function getServiceManager()
	{
	    return $this->getServiceInjector();
	}
}
